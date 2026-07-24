import { html, nothing, svg, type PropertyValues, type TemplateResult, type SVGTemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId } from '../../../internal/a11y.js';
import { closeIcon, expandIcon, fileIcon } from '../../../internal/icons.js';
import { finiteRange } from '../../../internal/numbers.js';
import { styles } from './attachment-chip.styles.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { FILE_SIZE_UNIT_KEYS, formatFileSize } from './file-size.js';

export { FILE_SIZE_UNIT_KEYS, formatFileSize } from './file-size.js';

export type AttachmentChipStatus = 'pending' | 'uploading' | 'error' | 'done';

export interface AttachmentChipIdDetail {
  id: string;
}

export interface AttachmentChipPreviewDetail extends AttachmentChipIdDetail {
  name: string;
  mimeType: string;
  src: string;
}

const ICON_VIEW_BOX = '0 0 24 24';
const ICON_STROKE_WIDTH = '1.75';

// Same shape as `<lr-chat-message>`'s local `retryIcon()` -- duplicated
// rather than imported (these are two independent, separately-consumable
// components) but kept visually identical so a retry affordance reads the
// same wherever it shows up in the library.
function retryIcon(): SVGTemplateResult {
  return svg`
    <svg
      width="1em"
      height="1em"
      viewBox=${ICON_VIEW_BOX}
      fill="none"
      stroke="currentColor"
      stroke-width=${ICON_STROKE_WIDTH}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    ><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
  `;
}

/** Visible (not just color-coded) text for every non-resting status --
 *  `'pending'`/`'done'` render nothing here, they're resting states.
 *  The caller supplies already-localized complete messages so translated
 *  word order and punctuation are preserved here. */
function statusText(
  status: AttachmentChipStatus,
  uploadingText: string,
  uploadFailedLabel: string,
): string {
  if (status === 'error') return uploadFailedLabel;
  if (status === 'uploading') return uploadingText;
  return '';
}

export interface LyraAttachmentChipEventMap {
  'lr-remove': CustomEvent<AttachmentChipIdDetail>;
  'lr-retry': CustomEvent<AttachmentChipIdDetail>;
  'lr-preview': CustomEvent<AttachmentChipPreviewDetail>;
}
/**
 * `<lr-attachment-chip>` — a compact chip representing one file queued for
 * (or already part of) a chat message: a composer's pre-send attachment
 * tray, or a sent message's `attachments` slot (see `<lr-chat-message>`).
 *
 * Two independent ways to populate it, matching the two points in a message's
 * lifecycle this is used at:
 *  - Set `file` to a real `File` (fresh from a picker/drop) — `name`, `size`,
 *    `mime-type` and the image thumbnail are all auto-derived from it.
 *  - Set the plain `name`/`size`/`mime-type`/`thumbnail-src` props instead,
 *    for reconstructing a chip from server-persisted attachment metadata
 *    (e.g. after a page reload, when no real `File` object exists any more).
 *
 * `file` always wins when both are present — see each accessor's own doc.
 * The image thumbnail for a real `File` is a cached `URL.createObjectURL()`
 * blob URL, created in the update lifecycle immediately before the thumbnail
 * renders and revoked automatically once `file`
 * changes away from the object it was created for, and on disconnect — this
 * component never leaks a blob URL.
 *
 * Identifying *which* attachment a `lr-remove`/`lr-retry` event is about:
 * this deliberately reuses the platform's own `id`/`id` attribute (every
 * element already has one; there's no need to shadow it with a second,
 * differently-named Lit property, unlike e.g. `<lr-tool-call-chip>`'s
 * `call-id` which identifies a *call*, a concept distinct from the chip
 * element itself). Set `id="..."` when you have a stable server-side
 * attachment id. When `id` is left unset and `file` is set, a stable id is
 * derived from `` `${file.name}:${file.size}:${file.lastModified}` `` — stable
 * across re-renders of the *same* `File` object without requiring the
 * consumer to invent one. When neither is available, a generated internal id
 * is used as a last resort so the event always has *some* id.
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
 * @event lr-remove - The user activated the remove (×) button. `detail: { id }`. Only rendered while `removable`.
 * @event lr-retry - The user activated the retry button. `detail: { id }`. Only rendered while `status="error"`.
 * @event lr-preview - The user activated the preview button. `detail: { id, name, mimeType, src }`.
 * @csspart base - The chip's root container.
 * @csspart thumbnail - The leading image thumbnail / generic file glyph.
 * @csspart meta - Wrapper around `name` and `size`.
 * @csspart name - The filename (ellipsis-truncated via CSS; the untruncated name is always available via the native `title` tooltip).
 * @csspart size - The human-readable formatted file size. Hidden when no size is known.
 * @csspart status-text - The visible text twin of the status accent color — carries the state in text, not just color. Empty/hidden for `pending`/`done`. Gets `role="alert"` for `status="error"` only, so a screen-reader user not already focused on the chip still hears an upload failure; the ticking `'uploading'` readout deliberately stays out of the accessibility tree the same way `<lr-generation-status>`'s per-second elapsed/token readout does — a live region re-announcing every progress tick would be noise, not information, while a one-shot failure is exactly the kind of infrequent, actionable transition a live region exists for.
 * @csspart progress - The numeric upload progress bar (`role="progressbar"`), shown only while `status="uploading"` and `progress` is a meaningful (>0) number.
 * @csspart progress-fill - The filled portion of `progress`.
 * @csspart spinner - The indeterminate upload spinner, shown instead of `progress` while `status="uploading"` and `progress` is unset/0.
 * @csspart retry-button - The retry affordance, only rendered while `status="error"`.
 * @csspart preview-button - The preview affordance, rendered when a file or `preview-src` is available.
 * @csspart remove-button - The remove (×) affordance, only rendered while `removable`.
 * @cssprop [--lr-attachment-chip-spinner-duration=0.8s] - Duration of one indeterminate
 * upload-spinner rotation. The ambient loop stops under reduced motion.
 * @cssprop [--lr-attachment-chip-accent=var(--lr-color-text-quiet)] - Accent color used for the
 * status text, spinner, and progress fill. Auto-swapped per `status`
 * (`uploading`/`error`/`done`); the default is the neutral `pending` tone.
 * @cssprop [--lr-attachment-chip-bg=var(--lr-color-surface)] - Chip background, auto-swapped per
 * `status` to that status's `-quiet` tint.
 * @cssprop [--lr-attachment-chip-border=var(--lr-color-border)] - Chip border color. Every
 * non-`pending` `status` sets it to `transparent`.
 * @cssprop [--lr-attachment-chip-compact-thumbnail-size=var(--lr-size-1-75rem)] - Thumbnail
 * and retry/preview/remove-button minimum size while `compact`, rethemeable independently of
 * `--lr-icon-button-size`.
 * @cssprop [--lr-attachment-chip-compact-font-size=var(--lr-font-size-xs)] - Font size of
 * `[part="base"]` while `compact`.
 * @cssprop [--lr-attachment-chip-compact-gap=var(--lr-size-0-25rem)] - Gap between the chip's parts
 * while `compact`.
 */
export class LyraAttachmentChip extends LyraElement<LyraAttachmentChipEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** A real `File`, e.g. fresh from `<lr-file-input>`'s `lr-files` event.
   *  When set, `name`/`size`/`mime-type`/the image thumbnail are all derived
   *  from it, taking precedence over the independent props below. */
  @property({ attribute: false }) file?: File;

  /** Filename, used only while `file` is unset. */
  @property() name = '';

  /** File size in bytes, used only while `file` is unset. NaN/negative normalize to `0` (renders
   *  as "unknown size", same as an unset size) via `effectiveSize` -- see that getter. */
  @property({ type: Number }) size = 0;

  /** MIME type, used only while `file` is unset. */
  @property({ attribute: 'mime-type' }) mimeType = '';

  /** Thumbnail image URL, used only while `file` is unset (a real `File`'s
   *  thumbnail always comes from a generated object URL instead — see the
   *  class doc). Unlike the other independent props this one has no
   *  `file`-derived equivalent to defer to for a non-image file; it's simply
   *  rendered whenever present. */
  @property({ attribute: 'thumbnail-src' }) thumbnailSrc = '';

  /** URL used to preview or download the attachment when `file` is unset.
   *  A real `File` takes precedence and is previewed through a temporary blob URL. */
  @property({ attribute: 'preview-src' }) previewSrc = '';

  /** Shows the preview action when a `file` or `preview-src` is available. */
  @property({ type: Boolean, reflect: true, converter: trueDefaultBooleanConverter }) previewable = true;

  /** Lifecycle state — drives the accent tint and which of `progress`/`spinner`/`retry-button` renders. */
  @property({ reflect: true }) status: AttachmentChipStatus = 'pending';

  /** Upload completion, 0-100. Only meaningful while `status="uploading"`;
   *  a value of 0 (the default), `NaN`, or negative falls back to the indeterminate spinner
   *  (see `hasNumericProgress`); an oversized value clamps to 100 (see `clampedProgress`). */
  @property({ type: Number }) progress = 0;

  /** Shows the remove (×) button. */
  @property({ type: Boolean, reflect: true, converter: trueDefaultBooleanConverter }) removable = true;

  /** Renders a smaller, borderless pill presentation instead of the default bordered/chrome-heavy
   *  chip -- for a consumer that wants an icon-only-adjacent, compact attachment affordance (e.g.
   *  a composer's pending-attachment tray) without hand-tuning several `::part()` custom
   *  properties individually. `false` (the default) is visually identical to today. */
  @property({ type: Boolean, reflect: true }) compact = false;

  /** When both this and `compact` are set, hides `[part=meta]` (the filename/size text) entirely
   *  for an image-mime attachment, leaving only the thumbnail -- for a consumer wanting a
   *  thumbnail-only density purely through props, with no consumer-side CSS. Has no effect for a
   *  non-image chip (there is no thumbnail to fall back to showing on its own) or when `compact` is
   *  unset. `false` (the default) reproduces today's exact output. */
  @property({ type: Boolean, reflect: true, attribute: 'thumbnail-only' }) thumbnailOnly = false;

  /** Verb used in the remove button's accessible name. For complete control over translated
   *  word order and punctuation, override the `removeWithContext` message instead. */
  @property({ attribute: 'remove-label' }) removeLabel = 'Remove';

  /** Verb used in the retry button's accessible name. For complete control over translated word
   *  order and punctuation, override the `attachmentRetryWithContext` message instead. */
  @property({ attribute: 'retry-label' }) retryLabel = 'Retry';

  /** Verb used in uploading messages. For complete control over translated word order and
   *  punctuation, override the `attachmentUploadingWithContext`,
   *  `attachmentUploadingProgress`, and `attachmentUploadingIndeterminate` messages instead. */
  @property({ attribute: 'uploading-label' }) uploadingLabel = 'Uploading';

  /** Visible status text shown for `status="error"`. Override for
   *  i18n/locale. Defaults to `'Upload failed'`, reproducing today's exact
   *  text byte-for-byte. */
  @property({ attribute: 'upload-failed-label' }) uploadFailedLabel = 'Upload failed';

  /** Override for the empty-name fallback shown (and used as the `title` tooltip) when neither
   *  `file` nor `name` supply a filename -- for i18n/locale. Defaults to `'Untitled file'`,
   *  reproducing today's exact hardcoded text byte-for-byte. */
  @property({ attribute: 'untitled-label' }) untitledLabel = 'Untitled file';

  // The object URL created for `file`'s image thumbnail, plus the exact
  // `File` it was created for (so a later `file` re-assignment to a
  // *different* File — including `undefined` — can be detected and the old
  // URL revoked, even if the new value never triggers another
  // `ensureObjectUrl()` call because it isn't itself an image).
  private objectUrl?: string;
  private objectUrlFile?: File;

  @state() private previewOpen = false;

  // Last-resort id, generated once per instance -- see the class doc's
  // "Identifying which attachment..." section.
  private readonly fallbackId = nextId('attachment-chip');

  private get effectiveName(): string {
    return this.file ? this.file.name : this.name;
  }

  private get effectiveSize(): number {
    // `File.size` is always a genuine finite non-negative number; only the independent `size`
    // prop (a plain reactive property, so a caller could pass NaN/negative) needs guarding.
    return this.file ? this.file.size : finiteRange(this.size, 0, 0);
  }

  private get effectiveMimeType(): string {
    return this.file ? this.file.type : this.mimeType;
  }

  private get effectivePreviewSrc(): string {
    return this.file ? this.objectUrl ?? '' : this.previewSrc;
  }

  private get resolvedId(): string {
    if (this.id) return this.id;
    if (this.file) return `${this.file.name}:${this.file.size}:${this.file.lastModified}`;
    return this.fallbackId;
  }

  private get hasNumericProgress(): boolean {
    return this.status === 'uploading' && this.clampedProgress > 0;
  }

  private get clampedProgress(): number {
    return finiteRange(this.progress, 0, 0, 100);
  }

  /** Returns (creating or reusing as needed) the object URL for `file`'s
   * image thumbnail. Called from the update lifecycle, never from `render()`,
   * so rendering stays a pure projection of already-prepared state. */
  private ensureObjectUrl(file: File): string {
    if (this.objectUrlFile === file && this.objectUrl) return this.objectUrl;
    this.revokeObjectUrl();
    this.objectUrl = URL.createObjectURL(file);
    this.objectUrlFile = file;
    return this.objectUrl;
  }

  private revokeObjectUrl(): void {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = undefined;
    this.objectUrlFile = undefined;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this.requestUpdate();
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (
      this.hasUpdated &&
      (changed.has('file') || changed.has('previewSrc') || changed.has('mimeType') || changed.has('name'))
    ) {
      this.previewOpen = false;
    }
    // Prepare or revoke the non-reactive cache before render. This keeps URL
    // allocation out of the render phase and also handles a file changing to
    // a non-image or to undefined, where no thumbnail render would otherwise
    // revisit the old cache entry.
    if (this.file && (this.file.type.startsWith('image/') || this.previewable)) this.ensureObjectUrl(this.file);
    else if (this.objectUrlFile) this.revokeObjectUrl();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.previewOpen = false;
    this.revokeObjectUrl();
  }

  private onRemoveClick = (): void => {
    this.emit<AttachmentChipIdDetail>('lr-remove', { id: this.resolvedId });
  };

  private onRetryClick = (): void => {
    this.emit<AttachmentChipIdDetail>('lr-retry', { id: this.resolvedId });
  };

  private onPreviewClick = (): void => {
    if (!this.effectivePreviewSrc) return;
    this.previewOpen = true;
    this.emit<AttachmentChipPreviewDetail>('lr-preview', {
      id: this.resolvedId,
      name: this.effectiveName,
      mimeType: this.effectiveMimeType,
      src: this.effectivePreviewSrc,
    });
  };

  private onViewerClose = (): void => {
    this.previewOpen = false;
  };

  private renderThumbnail(): TemplateResult {
    if (this.file) {
      return this.effectiveMimeType.startsWith('image/')
        ? html`<img src=${this.objectUrl ?? ''} alt="" />`
        : html`${fileIcon()}`;
    }
    // No `file`: `thumbnail-src` is used whenever present, regardless of
    // `mime-type` -- a server-generated preview thumbnail (e.g. a rendered
    // first page of a PDF) is itself always an image, independent of the
    // *source* file's own MIME type.
    return this.thumbnailSrc ? html`<img src=${this.thumbnailSrc} alt="" />` : html`${fileIcon()}`;
  }

  override render(): TemplateResult {
    const name = this.effectiveName;
    // Only routed through `this.localize()` when left at its hardcoded
    // default -- an explicit `untitled-label` override always wins verbatim,
    // matching `removeLabel`/`retryLabel` below.
    const untitledLabel = this.localize(
      'attachmentUntitledFile',
      this.untitledLabel === 'Untitled file' ? undefined : this.untitledLabel,
    );
    const displayName = name || untitledLabel;
    // A `0`-byte size reads the same as "unknown" here (there's no prop to
    // distinguish a genuinely empty file from a size that was simply never
    // supplied) -- hide the part entirely rather than show a literal "0 B".
    const sizeText =
      this.effectiveSize > 0
        ? formatFileSize(
            this.effectiveSize,
            (unit) => this.localize(FILE_SIZE_UNIT_KEYS[unit]),
            (value, fractionDigits) =>
              getNumberFormat(this.effectiveLocale, {
                minimumFractionDigits: fractionDigits,
                maximumFractionDigits: fractionDigits,
              }).format(value),
          )
        : '';
    // Same override-wins-verbatim rule as `untitledLabel` above.
    const uploadFailedLabel = this.localize(
      'attachmentUploadFailed',
      this.uploadFailedLabel === 'Upload failed' ? undefined : this.uploadFailedLabel,
    );
    const progressPercent = getNumberFormat(this.effectiveLocale, { maximumFractionDigits: 0 }).format(
      Math.round(this.clampedProgress),
    );
    const uploadingText = this.hasNumericProgress
      ? this.localize(
          'attachmentUploadingProgress',
          this.uploadingLabel === 'Uploading' ? undefined : `${this.uploadingLabel} {percent}%`,
          { percent: progressPercent },
        )
      : this.localize(
          'attachmentUploadingIndeterminate',
          this.uploadingLabel === 'Uploading' ? undefined : `${this.uploadingLabel}…`,
        );
    const uploadingWithContext = this.localize(
      'attachmentUploadingWithContext',
      this.uploadingLabel === 'Uploading' ? undefined : `${this.uploadingLabel} {label}`,
      { label: displayName },
    );
    const retryWithContext = this.localize(
      'attachmentRetryWithContext',
      this.retryLabel === 'Retry' ? undefined : `${this.retryLabel} {label}`,
      { label: displayName },
    );
    const removeWithContext = this.localize(
      'removeWithContext',
      this.removeLabel === 'Remove' ? undefined : `${this.removeLabel} {label}`,
      { label: displayName },
    );
    const text = statusText(this.status, uploadingText, uploadFailedLabel);
    const uploading = this.status === 'uploading';

    return html`
      <div part="base">
        <span part="thumbnail" aria-hidden="true">${this.renderThumbnail()}</span>
        <span
          part="meta"
          ?hidden=${this.compact && this.thumbnailOnly && this.effectiveMimeType.startsWith('image/')}
        >
          <span part="name" title=${name || untitledLabel}>${displayName}</span>
          <span part="size" ?hidden=${!sizeText}>${sizeText || nothing}</span>
          <span part="status-text" role=${this.status === 'error' ? 'alert' : nothing} ?hidden=${!text}>${text || nothing}</span>
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
                  <div part="progress-fill" style=${`inline-size:${this.clampedProgress}%`}></div>
                </div>
              `
            : html`<span part="spinner" role="status" aria-label=${uploadingWithContext}></span>`
          : nothing}
        ${this.status === 'error'
          ? html`<button part="retry-button" type="button" aria-label=${retryWithContext} @click=${this.onRetryClick}>
              ${retryIcon()}
            </button>`
          : nothing}
        ${this.previewable && this.effectivePreviewSrc
          ? html`<button
              part="preview-button"
              type="button"
              aria-label=${name ? this.localize('attachmentPreviewName', undefined, { name: displayName }) : this.localize('attachmentPreviewFile')}
              @click=${this.onPreviewClick}
            >${expandIcon()}</button>`
          : nothing}
        ${this.removable
          ? html`<button part="remove-button" type="button" aria-label=${removeWithContext} @click=${this.onRemoveClick}>
              ${closeIcon()}
            </button>`
          : nothing}
      </div>
      ${this.previewable && this.effectivePreviewSrc
        ? html`<lr-document-viewer
            .open=${this.previewOpen}
            .name=${displayName}
            .mimeType=${this.effectiveMimeType}
            .src=${this.effectivePreviewSrc}
            @lr-close=${this.onViewerClose}
          ></lr-document-viewer>`
        : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-attachment-chip': LyraAttachmentChip;
  }
}
