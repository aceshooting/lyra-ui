import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import type { LyraMessageKey } from '../../internal/localization.js';
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
 */
export class LyraFileIcon extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** MIME type used to resolve metadata. */
  @property({ attribute: 'mime-type' }) mimeType = '';
  /** Optional filename used for fallback detection with an empty or generic MIME type. */
  @property() name = '';
  /** Whether the badge is decorative and hidden from assistive technology. */
  @property({ type: Boolean, reflect: true }) decorative = false;
  /** Shows only the icon or the icon together with its localized label. */
  @property({ reflect: true }) variant: LyraFileIconVariant = 'icon';
  /** Optional visible/accessibility label override. */
  @property() label = '';

  render(): TemplateResult {
    const metadata = getFileTypeMetadata(this.mimeType, this.name);
    const localizedLabel = this.label || this.localize(ICON_LABELS[metadata.icon]);
    return html`
      <span part="base" role=${this.decorative ? 'presentation' : 'img'} aria-label=${this.decorative ? nothing : localizedLabel}>
        <span part="icon" aria-hidden="true">${this.localize(ICON_LABELS[metadata.icon])}</span>
        ${this.variant === 'label' ? html`<span part="label">${localizedLabel}</span>` : nothing}
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'lyra-file-icon': LyraFileIcon; }
}
