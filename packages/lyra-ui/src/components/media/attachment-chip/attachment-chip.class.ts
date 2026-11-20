import {
  html,
  nothing,
  type PropertyValues,
  type PropertyDeclaration,
  type TemplateResult,
} from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId } from '../../../internal/a11y.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { closeIcon, expandIcon, fileIcon, retryIcon } from '../../../internal/icons.js';
import { normalizeLabel } from '../../../internal/accessible-name.js';
import { finiteRange } from '../../../internal/numbers.js';
import { safeMediaSrc } from '../../../internal/safe-url.js';
import { styles } from './attachment-chip.styles.js';
import {
  normalizeReflectedOptionalSize,
  normalizeSize,
  optionalSizeConverter,
  type LyraSize,
} from '../../../internal/variants.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { formatFileSize } from '../../../internal/bytes.js';
import { blankNumberConverter } from '../../../internal/converters.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_attachmentPreviewFile, LYRA_DEFAULT_attachmentPreviewName, LYRA_DEFAULT_attachmentRetryWithContext, LYRA_DEFAULT_attachmentUploadFailed, LYRA_DEFAULT_attachmentUploadingIndeterminate, LYRA_DEFAULT_attachmentUploadingProgress, LYRA_DEFAULT_attachmentUploadingWithContext } from '../../../internal/default-strings/media.generated.js';
import { LYRA_DEFAULT_attachmentUntitledFile, LYRA_DEFAULT_removeWithContext } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type LyraAttachmentUploadStatus =
  | 'pending'
  | 'uploading'
  | 'error'
  | 'success';

export interface LyraAttachmentIdDetail {
  attachmentId: string;
}

export interface LyraAttachmentPreviewRequestDetail
  extends LyraAttachmentIdDetail {
  name: string;
  mimeType: string;
  src: string;
}

/** Whether a `size` selects the compact density (`s` and the steps below it). */
function isCompactSize(size: LyraSize | undefined): boolean {
  if (size === undefined) return false;
  const step = normalizeSize(size);
  return step === '2xs' || step === 'xs' || step === 's';
}
/** Visible (not just color-coded) text for every non-resting status --
 *  `'pending'`/`'success'` render nothing here, they're resting states.
 *  The caller supplies already-localized complete messages so translated
 *  word order and punctuation are preserved here. */
function statusText(
  status: LyraAttachmentUploadStatus,
  uploadingText: string,
  uploadFailedLabel: string
): string {
  if (status === 'error') return uploadFailedLabel;
  if (status === 'uploading') return uploadingText;
  return '';
}

/** Fills the `{label}`/`{percent}` placeholders of a caller-supplied message. */
function fillMessage(message: string, values: Record<string, string>): string {
  return message.replace(/\{(label|percent)\}/g, (match, key: string) => values[key] ?? match);
}

export interface LyraAttachmentChipEventMap {
  'lr-remove': CustomEvent<LyraAttachmentIdDetail>;
  'lr-retry': CustomEvent<LyraAttachmentIdDetail>;
  'lr-preview-request': CustomEvent<LyraAttachmentPreviewRequestDetail>;
}
/**
 * `<lr-attachment-chip>` — a compact chip representing one file queued for
 * (or already part of) a chat message: a composer's pre-send attachment
 * tray, or a sent message's `attachments` slot (see `<lr-chat-message>`).
 *
 * Two independent ways to populate it, matching the two points in a message's
 * lifecycle this is used at:
 *  - Set `file` to a real `File` (fresh from a picker/drop) — `name`, `bytes`,
 *    `mime-type` and the image thumbnail are all auto-derived from it.
 *  - Set the plain `name`/`bytes`/`mime-type`/`thumbnail-src` props instead,
 *    for reconstructing a chip from server-persisted attachment metadata
 *    (e.g. after a page reload, when no real `File` object exists any more).
 *
 * `file` wins for `name`/`bytes`/`mime-type` when both are present — see each
 * accessor's own doc. The image thumbnail and the preview source for a real
 * `File` default to a cached `URL.createObjectURL()` blob URL, created in the
 * update lifecycle immediately before the thumbnail renders and revoked
 * automatically once `file` changes away from the object it was created for,
 * once host-supplied sources make it unnecessary, and on disconnect — this
 * component never leaks a blob URL. A non-empty, safe `thumbnail-src` (and a
 * non-empty `preview-src`) takes precedence over that blob URL even while
 * `file` is set, so a page whose Content-Security-Policy has no `blob:` in
 * `img-src` can keep passing the `File` for name/size/type and supply its own
 * `data:` or same-origin thumbnail: with both set (or `thumbnail-src` plus
 * `without-preview`) no blob URL is ever created. Otherwise, showing a `File`'s
 * own image needs `blob:` in `img-src`.
 *
 * Identifying *which* attachment a `lr-remove`/`lr-retry`/`lr-preview-request` event is about:
 * set `attachment-id="..."` when you have a stable server-side attachment identity. The platform
 * `id` remains available for DOM identity and idrefs. When `attachmentId` is blank and `file` is
 * set, a stable attachment identity is derived from
 * `` `${file.name}:${file.size}:${file.lastModified}` ``, so chips showing the same `File` share it;
 * set `attachment-id` to tell them apart. When neither is available, each chip reports its own
 * generated id.
 *
 * i18n/locale: complete contextual messages (including filename/percentage
 * placement and punctuation) route through the shared localization registry.
 * `removeLabel`/`retryLabel`/`uploadingLabel`/`uploadFailedLabel` remain as
 * simple per-instance copy overrides; use the component's `.strings` map or a
 * registered locale when a translation needs to reorder the interpolated
 * values. These are plain properties, not slots — this component still
 * exposes no slots.
 *
 * @customElement lr-attachment-chip
 * @event lr-remove - The user activated the remove (×) button. `detail: { attachmentId }`. Not rendered while `without-remove-button` is set.
 * @event lr-retry - The user activated the retry button. `detail: { attachmentId }`. Only rendered while `status="error"`.
 * @event lr-preview-request - Notification that the preview action was activated. `detail: { attachmentId, name, mimeType, src }`. Not cancelable: the chip never registers or owns a viewer/overlay, so there is nothing local to gate behind `.preventDefault()`; consumers compose the desired preview surface entirely on their own.
 * @csspart base - The chip's root container.
 * @csspart thumbnail - The leading image thumbnail / generic file glyph.
 * @csspart meta - Wrapper around the filename and the formatted file size.
 * @csspart name - The filename (ellipsis-truncated via CSS; the untruncated name is always available via the native `title` tooltip).
 * @csspart size - The human-readable formatted file size, from `bytes` (or the `file`'s own byte
 * count). Hidden when no size is known.
 * @csspart status-text - The visible text twin of the status accent color — carries uploading/error state in text. Empty/hidden for `pending`/`success`; forced-colors mode retains distinct border patterns for every state. Plain visible text, so it reads normally once a user reaches the chip; the interrupting announcement that a transition *into* `status="error"` makes goes through the shared light-DOM assertive region.
 * @csspart progress - The numeric upload progress bar (`role="progressbar"`), shown only while `status="uploading"` and `progress` is a meaningful (>0) number.
 * @csspart progress-fill - The filled portion of `progress`.
 * @csspart spinner - Decorative (`aria-hidden`) indeterminate upload spinner, shown instead of
 *   `progress` while `status="uploading"` and `progress` is unset/0; the adjacent status text
 *   carries the visible wording, and upload ticks never enter a live region.
 * @csspart retry-button - The retry affordance, only rendered while `status="error"`.
 * @csspart preview-button - The preview affordance, rendered when a file or `preview-src` is
 * available unless `without-preview` is set.
 * @csspart remove-button - The remove (×) affordance, rendered unless `without-remove-button` is
 * set.
 * @cssprop [--lr-attachment-chip-spinner-duration=var(--lr-duration-ambient) linear] - Duration and
 * easing of one indeterminate upload-spinner rotation. The ambient loop stops under reduced motion.
 * @cssprop [--lr-attachment-chip-accent=var(--lr-color-text-quiet)] - Accent color used for the
 * status text, spinner, and progress fill. Its private default changes per `status`
 * (`uploading`/`error`/`success`); the public value remains authoritative.
 * @cssprop [--lr-attachment-chip-bg=var(--lr-color-surface)] - Chip background. Its private
 * default changes per `status` to that status's `-quiet` tint; the public value still wins.
 * @cssprop [--lr-attachment-chip-border=var(--lr-color-border-subtle)] - Chip border color. Every
 * non-`pending` `status` changes its private default to `transparent`.
 * @cssprop [--lr-attachment-chip-thumbnail-size=var(--lr-icon-button-size)] - Thumbnail size at the
 * default density, rethemeable independently of the action buttons' hit area.
 * @cssprop [--lr-attachment-chip-thumbnail-radius=calc(var(--lr-radius) * 0.6)] - Thumbnail corner radius.
 * @cssprop [--lr-attachment-chip-thumbnail-bg=var(--lr-color-surface)] - Thumbnail background behind
 *   the preview image or file glyph.
 * @cssprop [--lr-attachment-chip-action-hover-bg=color-mix(in srgb, var(--lr-color-text) 8%, transparent)] -
 * Hovered retry, preview, and remove button background.
 * @cssprop [--lr-attachment-chip-action-active-bg=color-mix(in oklab, transparent, var(--lr-color-mix-partner) var(--lr-color-mix-active))] -
 * Pressed retry, preview, and remove button background.
 * @cssprop [--lr-attachment-chip-compact-thumbnail-size=var(--lr-size-1-75rem)] - Thumbnail size
 * at the compact density (`size="s"` and below), rethemeable independently of
 * `--lr-icon-button-size`. Retry, preview, and remove actions retain that shared token's minimum
 * hit-area floor.
 * @cssprop [--lr-attachment-chip-compact-font-size=var(--lr-font-size-xs)] - Font size of
 * `[part="base"]` at the compact density.
 * @cssprop [--lr-attachment-chip-compact-gap=var(--lr-size-0-25rem)] - Gap between the chip's parts
 * at the compact density.
 * @cssprop [--lr-attachment-chip-padding=var(--lr-space-xs) var(--lr-space-s)] - Padding of
 * `[part="base"]` at the default density.
 * @cssprop [--lr-attachment-chip-compact-padding=var(--lr-size-0-125rem) var(--lr-space-xs)] -
 * Padding of `[part="base"]` at the compact density.
 * @cssprop [--lr-attachment-chip-compact-thumbnail-only-padding=var(--lr-size-0-125rem)] - Padding
 * of `[part="base"]` while the compact density and `thumbnail-only` together actually hide
 * `[part="meta"]` (an image-mime attachment only — see `thumbnailOnly`). Reduced from
 * `--lr-attachment-chip-compact-padding` since the lone thumbnail no longer needs inline padding
 * sized for a text row.
 * @status stable
 * @since 4.0.0
 */
export class LyraAttachmentChip extends LyraElement<LyraAttachmentChipEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    attachmentPreviewFile: LYRA_DEFAULT_attachmentPreviewFile,
    attachmentPreviewName: LYRA_DEFAULT_attachmentPreviewName,
    attachmentRetryWithContext: LYRA_DEFAULT_attachmentRetryWithContext,
    attachmentUntitledFile: LYRA_DEFAULT_attachmentUntitledFile,
    attachmentUploadFailed: LYRA_DEFAULT_attachmentUploadFailed,
    attachmentUploadingIndeterminate: LYRA_DEFAULT_attachmentUploadingIndeterminate,
    attachmentUploadingProgress: LYRA_DEFAULT_attachmentUploadingProgress,
    attachmentUploadingWithContext: LYRA_DEFAULT_attachmentUploadingWithContext,
    removeWithContext: LYRA_DEFAULT_removeWithContext,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** A real `File`, e.g. fresh from `<lr-file-input>`'s `lr-files` event.
   *  When set, `name`/`bytes`/`mime-type`/the image thumbnail are all derived
   *  from it, taking precedence over the independent props below. */
  @property({ attribute: false }) file?: File;

  /** Filename, used only while `file` is unset. */
  @property() name = '';

  private _bytes?: number;
  /** File size as a raw byte count, used only while `file` is unset. Named for what it holds
   *  rather than `size`, which in this library (this component included) names a size *tier*
   *  (`small`/`medium`/`large`, `xs`...`xl`). `0` is a known empty file and renders `0 B`; only
   *  omission means unknown. Non-finite/negative inputs are treated as unknown. */
  @property({ converter: blankNumberConverter(undefined) })
  get bytes(): number | undefined {
    return this._bytes;
  }
  set bytes(value: number | undefined) {
    const old = this._bytes;
    this._bytes =
      typeof value === 'number' && Number.isFinite(value) && value >= 0
        ? finiteRange(value, 0, 0)
        : undefined;
    this.requestUpdate('bytes', old);
  }

  /** Domain id for attachment actions. Empty or whitespace-only values use a stable per-chip id. */
  @property({ attribute: 'attachment-id', useDefault: true }) attachmentId = '';

  /** MIME type, used only while `file` is unset. */
  @property({ attribute: 'mime-type', useDefault: true }) mimeType = '';

  /** Thumbnail image URL. Rendered whenever present and safe, also while `file` is set: it then
   *  replaces the blob URL a `File`'s own image thumbnail would otherwise use (see the class doc),
   *  for example a small `data:` thumbnail under a Content-Security-Policy without `blob:`. Like
   *  the no-`file` case it renders regardless of the MIME type, since a generated thumbnail is
   *  always an image. Unsafe schemes are ignored. */
  @property({ attribute: 'thumbnail-src' }) thumbnailSrc = '';

  /** URL used to preview or download the attachment. While `file` is set and this is empty, the
   *  `File` is previewed through a temporary blob URL instead; a non-empty value wins over it. */
  @property({ attribute: 'preview-src' }) previewSrc = '';

  /** Hides the preview action, which otherwise renders whenever a `file` or `preview-src` is
   *  available. */
  @property({ type: Boolean, reflect: true, attribute: 'without-preview' })
  withoutPreview = false;

  /** Lifecycle state — drives the accent tint and which of `progress`/`spinner`/`retry-button` renders.
   * Failures already present on reconnect render silently; new connected failures announce once. */
  @property({ reflect: true }) status: LyraAttachmentUploadStatus = 'pending';

  /** Upload completion, 0-100. Only meaningful while `status="uploading"`;
   *  a value of 0 (the default), `NaN`, or negative falls back to the indeterminate spinner
   *  (see `hasNumericProgress`); an oversized value clamps to 100 (see `clampedProgress`). */
  @property({ converter: blankNumberConverter(0) }) progress = 0;

  /** Hides the remove (×) button, which otherwise renders. */
  @property({ type: Boolean, reflect: true, attribute: 'without-remove-button' })
  withoutRemoveButton = false;

  private _size?: LyraSize;
  /** Density on the library's one size ladder, in either spelling — `2xs`/`xs`/`s`/`m`/`l`/`xl`,
   *  or `small`/`medium`/`large`. `s` and the steps below it select the compact density: a
   *  smaller, borderless pill instead of the default bordered chip, for an icon-only-adjacent
   *  attachment affordance (e.g. a composer's pending-attachment tray) without hand-tuning several
   *  `::part()` custom properties individually. `m` and the steps above it keep the default
   *  density. Opt-in: with no size the chip renders at the default density. Unsupported values
   *  normalize to the omitted state and remove the attribute. */
  @property({ reflect: true, converter: optionalSizeConverter })
  get size(): LyraSize | undefined {
    return this._size;
  }
  set size(next: LyraSize | undefined) {
    // Only a foreign (unsupported) raw attribute is repaired in place; a supported one is left for
    // reflection, preserving the supported author spelling.
    const raw = this.getAttribute('size');
    const normalized =
      raw !== null && optionalSizeConverter.normalize(raw) !== undefined
        ? optionalSizeConverter.normalize(next)
        : normalizeReflectedOptionalSize(this, next);
    const old = this._size;
    if (old === normalized) return;
    this._size = normalized;
    this.requestUpdate('size', old);
  }

  /** At the compact density (`size="s"` and below), hides `[part=meta]` (the filename/size text)
   *  entirely for an image-mime attachment, leaving only the thumbnail -- for a consumer wanting a
   *  thumbnail-only density purely through props, with no consumer-side CSS. Has no effect for a
   *  non-image chip (there is no thumbnail to fall back to showing on its own) or at the default
   *  density. `false` (the default) leaves it off. */
  @property({ type: Boolean, reflect: true, attribute: 'thumbnail-only' })
  thumbnailOnly = false;

  /** Accessible name of the remove button; `{label}` is replaced by the file name. Blank falls back
   *  to the localized `removeWithContext` message. */
  @property({ attribute: 'remove-label' }) removeLabel?: string;

  /** Accessible name of the retry button; `{label}` is replaced by the file name. Blank falls back
   *  to the localized `attachmentRetryWithContext` message. */
  @property({ attribute: 'retry-label' }) retryLabel?: string;

  /** Visible uploading status and the progress bar's accessible name; `{label}` is replaced by the
   *  file name and `{percent}` by the progress. An explicit empty value hides the visible status
   *  and falls back to the localized `attachmentUploadingWithContext` name. */
  @property({ attribute: 'uploading-label' }) uploadingLabel?: string;

  /** Visible status text shown for `status="error"`. Override for
   *  i18n/locale. Defaults to `'Upload failed'`. */
  @property({ attribute: 'upload-failed-label' }) uploadFailedLabel?: string;

  /** Override for the empty-name fallback shown (and used as the `title` tooltip) when neither
   *  `file` nor `name` supply a filename -- for i18n/locale. Defaults to `'Untitled file'`. A blank
   *  or whitespace-only value falls back to the default. */
  @property({ attribute: 'untitled-label' }) untitledLabel?: string;

  // The object URL created for `file`'s image thumbnail, plus the exact
  // `File` it was created for (so a later `file` re-assignment to a
  // *different* File — including `undefined` — can be detected and the old
  // URL revoked, even if the new value never triggers another
  // `ensureObjectUrl()` call because it isn't itself an image).
  private objectUrl?: string;
  private objectUrlFile?: File;
  private objectUrlOwner?: typeof URL;

  /** Owns the shared assertive light-DOM region used for upload failures. */
  private readonly announcements = new AnnouncementSinkController(this, { eager: ['assertive'] });

  private readonly fallbackId = nextId('attachment-chip');

  private get effectiveName(): string {
    return this.file ? this.file.name : this.name;
  }

  private get effectiveSize(): number | undefined {
    if (this.file) {
      return Number.isFinite(this.file.size) && this.file.size >= 0
        ? finiteRange(this.file.size, 0, 0)
        : undefined;
    }
    return this.bytes;
  }

  private get effectiveMimeType(): string {
    return this.file ? this.file.type : this.mimeType;
  }

  private get effectivePreviewSrc(): string {
    if (this.previewSrc) return this.previewSrc;
    return this.file ? this.objectUrl ?? '' : '';
  }

  /** The host-supplied thumbnail, when it is present and safe. */
  private get hostThumbnailSrc(): string | null {
    return safeMediaSrc(this.thumbnailSrc);
  }

  /** Whether `file` still needs its own blob URL: for the image thumbnail when no host thumbnail
   *  replaces it, or for the preview action when no `preview-src` replaces it. */
  private fileNeedsObjectUrl(file: File): boolean {
    const forThumbnail = file.type.startsWith('image/') && !this.hostThumbnailSrc;
    const forPreview = !this.withoutPreview && !this.previewSrc;
    return forThumbnail || forPreview;
  }

  private get resolvedId(): string {
    if (this.attachmentId.trim().length > 0) return this.attachmentId;
    if (this.file) return `${this.file.name}:${this.file.size}:${this.file.lastModified}`;
    return this.fallbackId;
  }

  private get hasNumericProgress(): boolean {
    return this.status === 'uploading' && this.clampedProgress > 0;
  }

  private get clampedProgress(): number {
    return finiteRange(this.progress, 0, 0, 100);
  }

  /** The compact density: `size` `s` and below. Mirrors the stylesheet's selectors exactly. */
  private get compactDensity(): boolean {
    return isCompactSize(this.size);
  }

  private get effectiveStatus(): LyraAttachmentUploadStatus {
    return this.status === 'uploading' ||
      this.status === 'error' ||
      this.status === 'success'
      ? this.status
      : 'pending';
  }

  /** Returns (creating or reusing as needed) the object URL for `file`'s
   * image thumbnail. Called from the update lifecycle, never from `render()`,
   * so rendering stays a pure projection of already-prepared state. */
  private ensureObjectUrl(file: File): string {
    const urlApi = this.ownerDocument.defaultView?.URL ?? globalThis.URL;
    if (this.objectUrlFile === file && this.objectUrl && this.objectUrlOwner === urlApi) return this.objectUrl;
    this.revokeObjectUrl();
    // Created and later revoked through the owner document's realm, which owns the preview.
    this.objectUrl = urlApi.createObjectURL(file);
    this.objectUrlOwner = urlApi;
    this.objectUrlFile = file;
    return this.objectUrl;
  }

  private revokeObjectUrl(): void {
    if (this.objectUrl) (this.objectUrlOwner ?? globalThis.URL).revokeObjectURL(this.objectUrl);
    this.objectUrl = undefined;
    this.objectUrlOwner = undefined;
    this.objectUrlFile = undefined;
  }

  private connectedStatusTransition = false;

  override requestUpdate(name?: PropertyKey, oldValue?: unknown, options?: PropertyDeclaration): void {
    // Record connected writes before Lit coalesces an uploading→error retry into one update.
    if (name === 'status' && this.isConnected && this.hasUpdated && oldValue !== this.status) {
      this.connectedStatusTransition = true;
    }
    super.requestUpdate(name, oldValue, options);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.connectedStatusTransition = false;
    if (this.hasUpdated) this.requestUpdate();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.announcements.adopted();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('status') && this.status !== this.effectiveStatus)
      this.status = this.effectiveStatus;
    // Only a *transition* into `error` announces: a chip that mounts already failed is history a
    // user can read at their own pace. Reconnection captures detached changes as that same
    // historical baseline; a new connected failure still announces. Announced
    // from the transition rather than from rendered text, so a retry that fails the same way twice
    // is read twice instead of the second failure being a silent no-op.
    if (this.isConnected && this.hasUpdated && this.connectedStatusTransition && this.status === 'error') {
      this.announcements.announceAssertive(this.localizedUploadFailedLabel);
    }
    this.connectedStatusTransition = false;
    // Prepare or revoke the non-reactive cache before render. This keeps URL
    // allocation out of the render phase and also handles a file changing to
    // a non-image or to undefined, where no thumbnail render would otherwise
    // revisit the old cache entry.
    if (this.isConnected && this.file && this.fileNeedsObjectUrl(this.file))
      this.ensureObjectUrl(this.file);
    else if (this.objectUrlFile) this.revokeObjectUrl();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.revokeObjectUrl();
  }

  /** The localized upload-failure message. Same override-wins-verbatim rule as `untitledLabel`;
   *  read both by `render()` and by the failure announcement in `willUpdate()`. */
  private get localizedUploadFailedLabel(): string {
    return normalizeLabel(this.uploadFailedLabel) ?? this.localize('attachmentUploadFailed');
  }

  private onRemoveClick = (): void => {
    this.emit('lr-remove', { attachmentId: this.resolvedId });
  };

  private onRetryClick = (): void => {
    this.emit('lr-retry', { attachmentId: this.resolvedId });
  };

  private onPreviewClick = (): void => {
    if (!this.effectivePreviewSrc) return;
    // Not cancelable -- see the class doc's `lr-preview-request` entry for why this component
    // (which, per the class doc, "never registers or owns a viewer/overlay") has no local
    // default action of its own to gate behind `.defaultPrevented`. Same rationale as
    // `stepper.class.ts`'s `lr-step-select` and `email-viewer.class.ts`'s `lr-attachment-open`.
    this.emit('lr-preview-request', {
      attachmentId: this.resolvedId,
      name: this.effectiveName,
      mimeType: this.effectiveMimeType,
      src: this.effectivePreviewSrc,
    });
  };

  private renderThumbnail(): TemplateResult {
    const hostThumbnailSrc = this.hostThumbnailSrc;
    if (this.file && !hostThumbnailSrc) {
      const fileImageSrc = this.objectUrl ? safeMediaSrc(this.objectUrl) : null;
      return this.effectiveMimeType.startsWith('image/')
        ? // `nothing`, never `''`: an empty `src` is a valid URL that resolves against the
          // document, so the browser would re-request the page itself as an image. The
          // object URL is always populated before this renders, so this is a guard rather
          // than a live path -- but `''` is the wrong guard to leave in place.
          fileImageSrc
          ? html`<img src=${fileImageSrc} alt="" />`
          : html`${fileIcon()}`
        : html`${fileIcon()}`;
    }
    // `thumbnail-src` is used whenever present, regardless of `mime-type` --
    // a server-generated preview thumbnail (e.g. a rendered first page of a
    // PDF) is itself always an image, independent of the *source* file's own
    // MIME type.
    return hostThumbnailSrc
      ? html`<img src=${hostThumbnailSrc} alt="" />`
      : html`${fileIcon()}`;
  }

  override render(): TemplateResult {
    const name = normalizeLabel(this.effectiveName) ?? '';
    const untitledLabel =
      normalizeLabel(this.untitledLabel) ?? this.localize('attachmentUntitledFile');
    const displayName = name || untitledLabel;
    const sizeText =
      this.effectiveSize !== undefined
        ? formatFileSize(this.effectiveSize, this.effectiveLocale)
        : '';
    const uploadFailedLabel = this.localizedUploadFailedLabel;
    const progressPercent = getNumberFormat(this.effectiveLocale, {
      maximumFractionDigits: 0,
    }).format(Math.round(this.clampedProgress));
    const uploadingText =
      this.uploadingLabel != null
        ? fillMessage(this.uploadingLabel, { label: displayName, percent: progressPercent })
        : this.hasNumericProgress
        ? this.localize('attachmentUploadingProgress', undefined, {
            percent: progressPercent,
          })
        : this.localize('attachmentUploadingIndeterminate');
    const uploadingWithContext = normalizeLabel(this.uploadingLabel)
      ? uploadingText
      : this.localize('attachmentUploadingWithContext', undefined, { label: displayName });
    const retryOverride = normalizeLabel(this.retryLabel);
    const retryWithContext = retryOverride
      ? fillMessage(retryOverride, { label: displayName })
      : this.localize('attachmentRetryWithContext', undefined, { label: displayName });
    const removeOverride = normalizeLabel(this.removeLabel);
    const removeWithContext = removeOverride
      ? fillMessage(removeOverride, { label: displayName })
      : this.localize('removeWithContext', undefined, { label: displayName });
    const status = this.effectiveStatus;
    const text = statusText(status, uploadingText, uploadFailedLabel);
    const uploading = status === 'uploading';

    return html`
      <div part="base">
        <span part="thumbnail" aria-hidden="true"
          >${this.renderThumbnail()}</span
        >
        <span
          part="meta"
          ?hidden=${this.compactDensity &&
          this.thumbnailOnly &&
          this.effectiveMimeType.startsWith('image/')}
        >
          <span part="name" title=${name || untitledLabel}>${displayName}</span>
          <span part="size" ?hidden=${!sizeText}>${sizeText || nothing}</span>
          <span part="status-text" ?hidden=${!text}>${text || nothing}</span>
        </span>
        ${uploading
          ? this.hasNumericProgress
            ? html`
                <div
                  part="progress"
                  role="progressbar"
                  aria-valuenow=${Math.round(this.clampedProgress)}
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-label=${uploadingWithContext}
                >
                  <div
                    part="progress-fill"
                    style=${`inline-size:${this.clampedProgress}%`}
                  ></div>
                </div>
              `
            : html`<span part="spinner" aria-hidden="true"></span>`
          : nothing}
        ${status === 'error'
          ? html`<button
              part="retry-button"
              type="button"
              aria-label=${retryWithContext}
              @click=${this.onRetryClick}
            >
              ${retryIcon()}
            </button>`
          : nothing}
        ${!this.withoutPreview && this.effectivePreviewSrc
          ? html`<button
              part="preview-button"
              type="button"
              aria-label=${name
                ? this.localize('attachmentPreviewName', undefined, {
                    name: displayName,
                  })
                : this.localize('attachmentPreviewFile')}
              @click=${this.onPreviewClick}
            >
              ${expandIcon()}
            </button>`
          : nothing}
        ${!this.withoutRemoveButton
          ? html`<button
              part="remove-button"
              type="button"
              aria-label=${removeWithContext}
              @click=${this.onRemoveClick}
            >
              ${closeIcon()}
            </button>`
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-attachment-chip': LyraAttachmentChip;
  }
}
