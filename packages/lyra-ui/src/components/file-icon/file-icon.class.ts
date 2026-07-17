import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import type { LyraMessageKey } from '../../internal/localization.js';
import { formatFileSize, FILE_SIZE_UNIT_KEYS } from '../attachment-chip/attachment-chip.js';
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

export type LyraFileIconVariant = 'icon' | 'label';

/**
 * Displays a localized, tokenized file-type badge from a MIME type.
 *
 * @customElement lyra-file-icon
 * @csspart base - The outer presentation wrapper.
 * @csspart icon - The format badge.
 * @csspart label - The localized format label in `variant="label"` mode.
 * @csspart size - The formatted `size`, shown alongside `label` in `variant="label"` mode when `size` is known.
 * @cssprop [--lyra-file-icon-size=var(--lyra-size-2rem)] - Inline/block size of the format badge.
 */
export class LyraFileIcon extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** MIME type used to resolve metadata. Also exposed as a `title` tooltip on the badge. */
  @property({ attribute: 'mime-type' }) mimeType = '';
  /** Optional filename used for fallback detection with an empty or generic MIME type. */
  @property() name = '';
  /** File size in bytes, shown alongside the label in `variant="label"` mode. `0` (the default) renders no size — matches `<lyra-attachment-chip>`'s `size` convention. */
  @property({ type: Number }) size = 0;
  /** Whether the badge is decorative and hidden from assistive technology. */
  @property({ type: Boolean, reflect: true }) decorative = false;
  /** Shows only the icon or the icon together with its localized label. */
  @property({ reflect: true }) variant: LyraFileIconVariant = 'icon';
  /** Optional visible/accessibility label override. */
  @property() label = '';

  render(): TemplateResult {
    const metadata = getFileTypeMetadata(this.mimeType, this.name);
    const localizedLabel = this.label || this.localize(ICON_LABELS[metadata.icon]);
    const sizeText = this.size > 0 ? formatFileSize(this.size, (unit) => this.localize(FILE_SIZE_UNIT_KEYS[unit])) : '';
    const accessibleLabel = sizeText
      ? this.localize('fileTypeWithSize', undefined, { label: localizedLabel, size: sizeText })
      : localizedLabel;
    return html`
      <span
        part="base"
        role=${this.decorative ? 'presentation' : 'img'}
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
  interface HTMLElementTagNameMap { 'lyra-file-icon': LyraFileIcon; }
}
