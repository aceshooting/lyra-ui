import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraMessageKey } from '../../../internal/localization.js';
import { formatFileSize, FILE_SIZE_UNIT_KEYS } from '../attachment-chip/file-size.js';
import { finiteRange } from '../../../internal/numbers.js';
import { getFileTypeMetadata, type LyraFileTypeIcon } from './file-type-metadata.js';
import { styles } from './file-icon.styles.js';

const ICON_LABELS: Record<LyraFileTypeIcon, LyraMessageKey> = {
  file: 'fileTypeFile',
  pdf: 'fileTypePdf',
  word: 'fileTypeWord',
  spreadsheet: 'fileTypeSpreadsheet',
  presentation: 'fileTypePresentation',
  text: 'fileTypeText',
  code: 'fileTypeCode',
  archive: 'fileTypeArchive',
  image: 'fileTypeImage',
  audio: 'fileTypeAudio',
  video: 'fileTypeVideo',
};

/**
 * How much of the badge is rendered. Deliberately NOT the shared `LyraVariant`: these are two
 * render modes (glyph only vs. glyph plus its localized label), not semantic tones, so they share
 * only the property name with the rest of the library's `variant`.
 */
export type LyraFileIconVariant = 'icon' | 'label';

/**
 * Displays a localized, tokenized file-type badge from a MIME type.
 *
 * @customElement lr-file-icon
 * @csspart base - The outer presentation wrapper.
 * @csspart icon - The format badge.
 * @csspart label - The localized format label in `variant="label"` mode.
 * @csspart size - The formatted `bytes` count, shown alongside `label` in `variant="label"` mode when `bytes` is non-zero.
 * @cssprop [--lr-file-icon-size=var(--lr-size-2rem)] - Inline/block size of the format badge.
 */
export class LyraFileIcon extends LyraElement {
  static override styles = [LyraElement.styles, styles];

  /** MIME type used to resolve metadata. Also exposed as a `title` tooltip on the badge. */
  @property({ attribute: 'mime-type' }) mimeType = '';
  /** Optional filename used for fallback detection with an empty or generic MIME type. */
  @property() name = '';
  /** File size **in bytes**, shown alongside the label in `variant="label"` mode. `0` (the default)
   *  renders no size. Named `bytes`, not `size`: everywhere else in this library `size` names a tier
   *  on the shared size ladder, and a numeric byte count answering to the same property name is the
   *  kind of collision a consumer only discovers at runtime. */
  @property({ type: Number }) bytes = 0;
  /** Whether the badge is decorative and hidden from assistive technology. */
  @property({ type: Boolean, reflect: true }) decorative = false;
  /** Shows only the icon or the icon together with its localized label. */
  @property({ reflect: true }) variant: LyraFileIconVariant = 'icon';
  /** Optional visible/accessibility label override. */
  @property() label = '';

  override render(): TemplateResult {
    const metadata = getFileTypeMetadata(this.mimeType, this.name);
    const localizedLabel = this.label || this.localize(ICON_LABELS[metadata.icon]);
    // A NaN/negative `bytes` (e.g. an invalid `bytes` attribute) would otherwise make `bytes > 0`
    // false anyway (so no crash), but normalizing here keeps it explicit and consistent with
    // this library's other numeric guards, rather than relying on that comparison quirk.
    const bytes = finiteRange(this.bytes, 0, 0);
    const sizeText =
      bytes > 0
        ? formatFileSize(
            bytes,
            (unit) => this.localize(FILE_SIZE_UNIT_KEYS[unit]),
            (value) => getNumberFormat(this.effectiveLocale, { maximumFractionDigits: 1 }).format(value),
          )
        : '';
    const fallbackLabel = sizeText
      ? this.localize('fileTypeWithSize', undefined, { label: localizedLabel, size: sizeText })
      : localizedLabel;
    const accessibleLabel = this.getAttribute('aria-label') || fallbackLabel;
    return html`
      <span
        part="base"
        role=${this.decorative ? 'presentation' : 'img'}
        aria-hidden=${this.decorative ? 'true' : nothing}
        aria-label=${this.decorative ? nothing : accessibleLabel}
        title=${this.mimeType || nothing}
      >
        <span part="icon" aria-hidden="true">${this.localize(ICON_LABELS[metadata.icon])}</span>
        ${this.variant === 'label' ? html`<span part="label">${localizedLabel}</span>` : nothing}
        ${this.variant === 'label' && sizeText ? html`<span part="size">${sizeText}</span>` : nothing}
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'lr-file-icon': LyraFileIcon; }
}
