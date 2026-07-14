import { html, nothing, svg, type TemplateResult, type SVGTemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { nextId } from '../../internal/a11y.js';
import { closeIcon } from '../../internal/icons.js';
import { styles } from './attachment-chip.styles.js';

export type AttachmentChipStatus = 'pending' | 'uploading' | 'error' | 'done';

export interface AttachmentChipIdDetail {
  id: string;
}

// Mirrors the shared icon set's viewBox/stroke conventions
// (internal/icons.ts's chevronIcon()/closeIcon()/etc.) without adding a
// generic-file glyph to that module -- it's off limits here -- so this one-off
// icon still reads as part of the same visual language as the rest of the
// library's inline icons. `closeIcon()` itself already exists there and is
// imported directly rather than duplicated (see `<lyra-toast-item>`'s /
// `<lyra-widget>`'s identical import for the same remove/dismiss glyph).
const ICON_VIEW_BOX = '0 0 24 24';
const ICON_STROKE_WIDTH = '1.75';

/** A generic "document" glyph, used as the thumbnail for any non-image file. */
function fileGlyph(): SVGTemplateResult {
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
    ><path d="M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
  `;
}

// Same shape as `<lyra-chat-message>`'s local `retryIcon()` -- duplicated
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

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/** Maps each BYTE_UNITS abbreviation to its LyraMessageKey, for callers that
 *  want a localized unit label (see formatFileSize's unitLabel parameter). */
export const FILE_SIZE_UNIT_KEYS: Record<(typeof BYTE_UNITS)[number], string> = {
  B: 'fileSizeUnitB',
  KB: 'fileSizeUnitKb',
  MB: 'fileSizeUnitMb',
  GB: 'fileSizeUnitGb',
  TB: 'fileSizeUnitTb',
};

/**
 * `512` -> `"512 B"`; `2415919` -> `"2.3 MB"`. Whole bytes never get a
 * decimal (there's no meaningful fraction of a byte); every unit past that
 * gets exactly one decimal place. Returns `""` for a negative/non-finite
 * input so a missing/unknown size renders nothing instead of `"NaN B"`.
 * `unitLabel` resolves each abbreviation to its displayed label -- defaults
 * to the identity function (today's plain English abbreviations), so every
 * existing single-argument call site/test is unaffected.
 */
export function formatFileSize(
  bytes: number,
  unitLabel: (unit: (typeof BYTE_UNITS)[number]) => string = (unit) => unit,
): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${Math.round(bytes)} ${unitLabel('B')}`;
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(1)} ${unitLabel(BYTE_UNITS[unitIndex])}`;
}

/** Visible (not just color-coded) text for every non-resting status --
 *  `'pending'`/`'done'` render nothing here, they're resting states.
 *  `clampedProgress` (not the raw `progress`) is what gets displayed, so the
 *  percentage shown here can never drift from the progressbar's own
 *  `aria-valuenow`/fill-width, which reads from the same clamped value.
 *  `uploadingLabel`/`uploadFailedLabel` are the host's (possibly overridden)
 *  verb/phrase -- defaulting to `'Uploading'`/`'Upload failed'` reproduces
 *  today's exact hardcoded text byte-for-byte. */
function statusText(
  status: AttachmentChipStatus,
  progress: number,
  clampedProgress: number,
  uploadingLabel: string,
  uploadFailedLabel: string,
): string {
  if (status === 'error') return uploadFailedLabel;
  if (status === 'uploading') {
    return Number.isFinite(progress) && progress > 0
      ? `${uploadingLabel} ${Math.round(clampedProgress)}%`
      : `${uploadingLabel}…`;
  }
  return '';
}

/**
 * `<lyra-attachment-chip>` — a compact chip representing one file queued for
 * (or already part of) a chat message: a composer's pre-send attachment
 * tray, or a sent message's `attachments` slot (see `<lyra-chat-message>`).
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
 * Identifying *which* attachment a `lyra-remove`/`lyra-retry` event is about:
 * this deliberately reuses the platform's own `id`/`id` attribute (every
 * element already has one; there's no need to shadow it with a second,
 * differently-named Lit property, unlike e.g. `<lyra-tool-call-chip>`'s
 * `call-id` which identifies a *call*, a concept distinct from the chip
 * element itself). Set `id="..."` when you have a stable server-side
 * attachment id. When `id` is left unset and `file` is set, a stable id is
 * derived from `` `${file.name}:${file.size}:${file.lastModified}` `` — stable
 * across re-renders of the *same* `File` object without requiring the
 * consumer to invent one. When neither is available, a generated internal id
 * is used as a last resort so the event always has *some* id.
 *
 * i18n/locale: every translatable word rendered by this component is
 * override-able via a dedicated property — `removeLabel`/`retryLabel`
 * (the verb prefixed to the remove/retry buttons' `aria-label`, keeping the
 * `displayName` interpolation), and `uploadingLabel`/`uploadFailedLabel` (the
 * verb/phrase used in the visible `status-text`, keeping the live percentage
 * interpolation for `uploadingLabel`). All four default to today's exact
 * hardcoded English text (`'Remove'`, `'Retry'`, `'Uploading'`, `'Upload
 * failed'`), so leaving them unset changes nothing. These are plain
 * properties, not slots — this component still exposes no slots.
 *
 * @customElement lyra-attachment-chip
 * @event lyra-remove - The user activated the remove (×) button. `detail: { id }`. Only rendered while `removable`.
 * @event lyra-retry - The user activated the retry button. `detail: { id }`. Only rendered while `status="error"`.
 * @csspart base - The chip's root container.
 * @csspart thumbnail - The leading image thumbnail / generic file glyph.
 * @csspart meta - Wrapper around `name` and `size`.
 * @csspart name - The filename (ellipsis-truncated via CSS; the untruncated name is always available via the native `title` tooltip).
 * @csspart size - The human-readable formatted file size. Hidden when no size is known.
 * @csspart status-text - The visible text twin of the status accent color — carries the state in text, not just color. Empty/hidden for `pending`/`done`. Gets `role="alert"` for `status="error"` only, so a screen-reader user not already focused on the chip still hears an upload failure; the ticking `'uploading'` readout deliberately stays out of the accessibility tree the same way `<lyra-generation-status>`'s per-second elapsed/token readout does — a live region re-announcing every progress tick would be noise, not information, while a one-shot failure is exactly the kind of infrequent, actionable transition a live region exists for.
 * @csspart progress - The numeric upload progress bar (`role="progressbar"`), shown only while `status="uploading"` and `progress` is a meaningful (>0) number.
 * @csspart progress-fill - The filled portion of `progress`.
 * @csspart spinner - The indeterminate upload spinner, shown instead of `progress` while `status="uploading"` and `progress` is unset/0.
 * @csspart retry-button - The retry affordance, only rendered while `status="error"`.
 * @csspart remove-button - The remove (×) affordance, only rendered while `removable`.
 */
export class LyraAttachmentChip extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** A real `File`, e.g. fresh from `<lyra-file-input>`'s `lyra-files` event.
   *  When set, `name`/`size`/`mime-type`/the image thumbnail are all derived
   *  from it, taking precedence over the independent props below. */
  @property({ attribute: false }) file?: File;

  /** Filename, used only while `file` is unset. */
  @property() name = '';

  /** File size in bytes, used only while `file` is unset. */
  @property({ type: Number }) size = 0;

  /** MIME type, used only while `file` is unset. */
  @property({ attribute: 'mime-type' }) mimeType = '';

  /** Thumbnail image URL, used only while `file` is unset (a real `File`'s
   *  thumbnail always comes from a generated object URL instead — see the
   *  class doc). Unlike the other independent props this one has no
   *  `file`-derived equivalent to defer to for a non-image file; it's simply
   *  rendered whenever present. */
  @property({ attribute: 'thumbnail-src' }) thumbnailSrc = '';

  /** Lifecycle state — drives the accent tint and which of `progress`/`spinner`/`retry-button` renders. */
  @property({ reflect: true }) status: AttachmentChipStatus = 'pending';

  /** Upload completion, 0-100. Only meaningful while `status="uploading"`;
   *  a value of 0 (the default) or `NaN` falls back to the indeterminate spinner. */
  @property({ type: Number }) progress = 0;

  /** Shows the remove (×) button. */
  @property({ type: Boolean, reflect: true }) removable = true;

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

  /** Verb used in the remove button's `aria-label`, interpolated as
   *  `` `${removeLabel} ${displayName}` `` -- override for i18n/locale.
   *  Defaults to `'Remove'`, reproducing today's exact `"Remove ${displayName}"`
   *  text byte-for-byte. */
  @property({ attribute: 'remove-label' }) removeLabel = 'Remove';

  /** Verb used in the retry button's `aria-label`, interpolated as
   *  `` `${retryLabel} ${displayName}` `` -- override for i18n/locale.
   *  Defaults to `'Retry'`, reproducing today's exact `"Retry ${displayName}"`
   *  text byte-for-byte. */
  @property({ attribute: 'retry-label' }) retryLabel = 'Retry';

  /** Verb used in the visible uploading status text -- rendered as
   *  `` `${uploadingLabel} ${percent}%` `` once progress is a meaningful
   *  number, else `` `${uploadingLabel}…` ``. Override for i18n/locale.
   *  Defaults to `'Uploading'`, reproducing today's exact `"Uploading N%"`/
   *  `"Uploading…"` text byte-for-byte. */
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

  // Last-resort id, generated once per instance -- see the class doc's
  // "Identifying which attachment..." section.
  private readonly fallbackId = nextId('attachment-chip');

  private get effectiveName(): string {
    return this.file ? this.file.name : this.name;
  }

  private get effectiveSize(): number {
    return this.file ? this.file.size : this.size;
  }

  private get effectiveMimeType(): string {
    return this.file ? this.file.type : this.mimeType;
  }

  private get resolvedId(): string {
    if (this.id) return this.id;
    if (this.file) return `${this.file.name}:${this.file.size}:${this.file.lastModified}`;
    return this.fallbackId;
  }

  private get hasNumericProgress(): boolean {
    return this.status === 'uploading' && Number.isFinite(this.progress) && this.progress > 0;
  }

  private get clampedProgress(): number {
    return Math.min(100, Math.max(0, this.progress));
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

  protected willUpdate(): void {
    // Prepare or revoke the non-reactive cache before render. This keeps URL
    // allocation out of the render phase and also handles a file changing to
    // a non-image or to undefined, where no thumbnail render would otherwise
    // revisit the old cache entry.
    if (this.file?.type.startsWith('image/')) this.ensureObjectUrl(this.file);
    else if (this.objectUrlFile) this.revokeObjectUrl();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.revokeObjectUrl();
  }

  private onRemoveClick = (): void => {
    this.emit<AttachmentChipIdDetail>('lyra-remove', { id: this.resolvedId });
  };

  private onRetryClick = (): void => {
    this.emit<AttachmentChipIdDetail>('lyra-retry', { id: this.resolvedId });
  };

  private renderThumbnail(): TemplateResult {
    if (this.file) {
      return this.effectiveMimeType.startsWith('image/')
        ? html`<img src=${this.objectUrl ?? ''} alt="" />`
        : html`${fileGlyph()}`;
    }
    // No `file`: `thumbnail-src` is used whenever present, regardless of
    // `mime-type` -- a server-generated preview thumbnail (e.g. a rendered
    // first page of a PDF) is itself always an image, independent of the
    // *source* file's own MIME type.
    return this.thumbnailSrc ? html`<img src=${this.thumbnailSrc} alt="" />` : html`${fileGlyph()}`;
  }

  render(): TemplateResult {
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
        ? formatFileSize(this.effectiveSize, (unit) => this.localize(FILE_SIZE_UNIT_KEYS[unit]))
        : '';
    // Same override-wins-verbatim rule as `untitledLabel` above.
    const uploadingLabel = this.localize(
      'attachmentUploading',
      this.uploadingLabel === 'Uploading' ? undefined : this.uploadingLabel,
    );
    const text = statusText(
      this.status,
      this.progress,
      this.clampedProgress,
      uploadingLabel,
      this.uploadFailedLabel,
    );
    const uploading = this.status === 'uploading';

    return html`
      <div part="base">
        <span part="thumbnail" aria-hidden="true">${this.renderThumbnail()}</span>
        <span part="meta">
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
                  aria-label=${`${uploadingLabel} ${displayName}`}
                >
                  <div part="progress-fill" style=${`inline-size:${this.clampedProgress}%`}></div>
                </div>
              `
            : html`<span part="spinner" role="status" aria-label=${`${uploadingLabel} ${displayName}`}></span>`
          : nothing}
        ${this.status === 'error'
          ? html`<button part="retry-button" type="button" aria-label=${`${this.localize('retry', this.retryLabel === 'Retry' ? undefined : this.retryLabel)} ${displayName}`} @click=${this.onRetryClick}>
              ${retryIcon()}
            </button>`
          : nothing}
        ${this.removable
          ? html`<button part="remove-button" type="button" aria-label=${`${this.localize('remove', this.removeLabel === 'Remove' ? undefined : this.removeLabel)} ${displayName}`} @click=${this.onRemoveClick}>
              ${closeIcon()}
            </button>`
          : nothing}
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lyra-attachment-chip': LyraAttachmentChip;
  }
}

