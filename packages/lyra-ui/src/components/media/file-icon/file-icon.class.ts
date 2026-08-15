import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraMessageKey } from '../../../internal/localization.js';
import { formatFileSize, FILE_SIZE_UNIT_KEYS } from '../attachment-chip/file-size.js';
import { finiteRange } from '../../../internal/numbers.js';
import { literalSetConverter } from '../../../internal/converters.js';
import {
  defaultFileTypeMetadataRegistry,
  type LyraFileTypeIcon,
  type LyraFileTypeMetadataRegistry,
  type LyraResolvedFileTypeMetadata,
} from './file-type-metadata.js';
import { styles } from './file-icon.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_fileSizeUnitB, LYRA_DEFAULT_fileSizeUnitGb, LYRA_DEFAULT_fileSizeUnitKb, LYRA_DEFAULT_fileSizeUnitMb, LYRA_DEFAULT_fileSizeUnitTb, LYRA_DEFAULT_fileTypeArchive, LYRA_DEFAULT_fileTypeAudio, LYRA_DEFAULT_fileTypeCode, LYRA_DEFAULT_fileTypeFile, LYRA_DEFAULT_fileTypeImage, LYRA_DEFAULT_fileTypePdf, LYRA_DEFAULT_fileTypePresentation, LYRA_DEFAULT_fileTypeSpreadsheet, LYRA_DEFAULT_fileTypeText, LYRA_DEFAULT_fileTypeVideo, LYRA_DEFAULT_fileTypeWithSize, LYRA_DEFAULT_fileTypeWord, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_progress, LYRA_DEFAULT_search, LYRA_DEFAULT_select } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


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

/** How much of the badge is rendered: glyph only, or glyph plus file metadata. */
export type LyraFileIconMode = 'icon' | 'label';

const FILE_ICON_MODE = literalSetConverter<LyraFileIconMode>(['icon', 'label'], 'icon');

/**
 * Displays a localized, tokenized file-type badge from a MIME type.
 *
 * @customElement lr-file-icon
 * @csspart base - The outer presentation wrapper.
 * @csspart icon - The format badge.
 * @csspart label - The localized or consumer-authored format label in `mode="label"` mode.
 * @csspart description - Consumer-authored metadata description in `mode="label"` mode.
 * @csspart size - The formatted `bytes` count, shown alongside `label` in `mode="label"` mode when `bytes` is non-zero.
 * @cssprop [--lr-file-icon-size=var(--lr-size-2rem)] - Inline/block size of the format badge.
 * @status stable
 * @since 4.0.0
 */
export class LyraFileIcon extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    fileSizeUnitB: LYRA_DEFAULT_fileSizeUnitB,
    fileSizeUnitGb: LYRA_DEFAULT_fileSizeUnitGb,
    fileSizeUnitKb: LYRA_DEFAULT_fileSizeUnitKb,
    fileSizeUnitMb: LYRA_DEFAULT_fileSizeUnitMb,
    fileSizeUnitTb: LYRA_DEFAULT_fileSizeUnitTb,
    fileTypeArchive: LYRA_DEFAULT_fileTypeArchive,
    fileTypeAudio: LYRA_DEFAULT_fileTypeAudio,
    fileTypeCode: LYRA_DEFAULT_fileTypeCode,
    fileTypeFile: LYRA_DEFAULT_fileTypeFile,
    fileTypeImage: LYRA_DEFAULT_fileTypeImage,
    fileTypePdf: LYRA_DEFAULT_fileTypePdf,
    fileTypePresentation: LYRA_DEFAULT_fileTypePresentation,
    fileTypeSpreadsheet: LYRA_DEFAULT_fileTypeSpreadsheet,
    fileTypeText: LYRA_DEFAULT_fileTypeText,
    fileTypeVideo: LYRA_DEFAULT_fileTypeVideo,
    fileTypeWithSize: LYRA_DEFAULT_fileTypeWithSize,
    fileTypeWord: LYRA_DEFAULT_fileTypeWord,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    progress: LYRA_DEFAULT_progress,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** MIME type used to resolve metadata. Also exposed as a `title` tooltip on the badge. */
  @property({ attribute: 'mime-type' }) mimeType = '';
  /** Optional filename used for fallback detection with an empty or generic MIME type. */
  @property() name = '';
  /** File size **in bytes**, shown alongside the label in `mode="label"` mode. `0` (the default)
   *  renders no size. Named `bytes`, not `size`: everywhere else in this library `size` names a tier
   *  on the shared size ladder, and a numeric byte count answering to the same property name is the
   *  kind of collision a consumer only discovers at runtime. */
  @property({ type: Number }) bytes = 0;
  /** Whether the badge is decorative and hidden from assistive technology. */
  @property({ type: Boolean, reflect: true }) decorative = false;
  /** Shows only the icon or the icon together with its label and optional description. */
  private _mode: LyraFileIconMode = 'icon';

  @property({ reflect: true, converter: FILE_ICON_MODE })
  get mode(): LyraFileIconMode {
    return this._mode;
  }
  set mode(next: LyraFileIconMode) {
    const normalized = FILE_ICON_MODE.normalizeReflected(this, 'mode', next);
    const old = this._mode;
    if (old === normalized) return;
    this._mode = normalized;
    this.requestUpdate('mode', old);
  }
  /** Optional visible/accessibility label override. Explicit empty text is preserved. */
  @property() label?: string;
  /** Immutable metadata authority for this instance. */
  @property({ attribute: false }) registry: LyraFileTypeMetadataRegistry = defaultFileTypeMetadataRegistry;

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
  }

  private resolveMetadata(): LyraResolvedFileTypeMetadata {
    try {
      if (this.registry && typeof this.registry.resolve === 'function') {
        return this.registry.resolve(this.mimeType, this.name);
      }
    } catch {
      // Invalid injected registries fail closed to the complete built-in generic record.
    }
    return defaultFileTypeMetadataRegistry.resolve('', '');
  }

  override render(): TemplateResult {
    const metadata = this.resolveMetadata();
    const metadataLabel = metadata.provenance === 'consumer'
      ? metadata.label
      : this.localize(ICON_LABELS[metadata.icon]);
    const renderedLabel = this.label ?? metadataLabel;
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
      ? this.localize('fileTypeWithSize', undefined, { label: renderedLabel, size: sizeText })
      : renderedLabel;
    const accessibleLabel = hostAriaLabel(this) ?? fallbackLabel;
    const descriptionId = metadata.provenance === 'consumer' && metadata.description
      ? 'metadata-description'
      : undefined;
    return html`
      <span
        part="base"
        role=${this.decorative ? 'presentation' : 'img'}
        aria-hidden=${this.decorative ? 'true' : nothing}
        aria-label=${this.decorative ? nothing : accessibleLabel}
        aria-describedby=${this.decorative || !descriptionId ? nothing : descriptionId}
        title=${this.mimeType || nothing}
      >
        <span part="icon" aria-hidden="true">${metadata.provenance === 'consumer' ? metadata.label : this.localize(ICON_LABELS[metadata.icon])}</span>
        ${this.mode === 'label' ? html`<span part="label">${renderedLabel}</span>` : nothing}
        ${this.mode === 'label' && descriptionId
          ? html`<span id=${descriptionId} part="description">${metadata.description}</span>`
          : nothing}
        ${this.mode === 'label' && sizeText ? html`<span part="size">${sizeText}</span>` : nothing}
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'lr-file-icon': LyraFileIcon; }
}
