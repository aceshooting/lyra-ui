import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { live } from 'lit/directives/live.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteRange } from '../../../internal/numbers.js';
import { safeMediaSrc } from '../../../internal/safe-url.js';
import { OwnerAnimationFrameWaiter } from '../../../internal/owner-animation-frame.js';
import { defaultEditorSettings, renderEditorImage, type EditorSettings } from './image-editor-pixels.js';
import { styles } from './image-editor.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_imageEditorAfter, LYRA_DEFAULT_imageEditorAspect, LYRA_DEFAULT_imageEditorBefore, LYRA_DEFAULT_imageEditorContrast, LYRA_DEFAULT_imageEditorCropScale, LYRA_DEFAULT_imageEditorCropX, LYRA_DEFAULT_imageEditorCropY, LYRA_DEFAULT_imageEditorCustom, LYRA_DEFAULT_imageEditorExport, LYRA_DEFAULT_imageEditorExportError, LYRA_DEFAULT_imageEditorExposure, LYRA_DEFAULT_imageEditorFlipX, LYRA_DEFAULT_imageEditorFlipY, LYRA_DEFAULT_imageEditorHighlights, LYRA_DEFAULT_imageEditorLabel, LYRA_DEFAULT_imageEditorMonochrome, LYRA_DEFAULT_imageEditorOriginal, LYRA_DEFAULT_imageEditorPreset, LYRA_DEFAULT_imageEditorSaturation, LYRA_DEFAULT_imageEditorShadows, LYRA_DEFAULT_imageEditorTint, LYRA_DEFAULT_imageEditorVibrance, LYRA_DEFAULT_imageEditorVignette, LYRA_DEFAULT_imageEditorVivid, LYRA_DEFAULT_imageEditorWarmth, LYRA_DEFAULT_imageViewerFailedToLoad, LYRA_DEFAULT_imageViewerRotate } from '../../../internal/default-strings/media.generated.js';
import { LYRA_DEFAULT_documentPreviewEmpty, LYRA_DEFAULT_documentPreviewTypeImage, LYRA_DEFAULT_loading } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


const adjustmentLabels = {
  exposure: 'imageEditorExposure', contrast: 'imageEditorContrast', highlights: 'imageEditorHighlights',
  shadows: 'imageEditorShadows', saturation: 'imageEditorSaturation', vibrance: 'imageEditorVibrance',
  warmth: 'imageEditorWarmth', tint: 'imageEditorTint', vignette: 'imageEditorVignette',
} as const;
type Adjustment = keyof typeof adjustmentLabels;
type CropControl = 'cropScale' | 'cropX' | 'cropY';
type Preset = 'original' | 'monochrome' | 'vivid' | 'custom';

export interface LyraImageEditorEventMap {
  'lr-export': CustomEvent<{ blob: Blob }>;
}

/**
 * Edits a photo locally and exports the edited crop at its original pixel density.
 * @customElement lr-image-editor
 * @event lr-export - The export button produced a PNG. The Blob is available in detail.blob.
 * @csspart base - The editor and its controls.
 * @csspart preview - The preview canvas.
 * @csspart controls - The editing controls.
 * @status experimental
 * @since 33.3.0
 */
export class LyraImageEditor extends LyraElement<LyraImageEditorEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    documentPreviewEmpty: LYRA_DEFAULT_documentPreviewEmpty,
    documentPreviewTypeImage: LYRA_DEFAULT_documentPreviewTypeImage,
    imageEditorAfter: LYRA_DEFAULT_imageEditorAfter,
    imageEditorAspect: LYRA_DEFAULT_imageEditorAspect,
    imageEditorBefore: LYRA_DEFAULT_imageEditorBefore,
    imageEditorContrast: LYRA_DEFAULT_imageEditorContrast,
    imageEditorCropScale: LYRA_DEFAULT_imageEditorCropScale,
    imageEditorCropX: LYRA_DEFAULT_imageEditorCropX,
    imageEditorCropY: LYRA_DEFAULT_imageEditorCropY,
    imageEditorCustom: LYRA_DEFAULT_imageEditorCustom,
    imageEditorExport: LYRA_DEFAULT_imageEditorExport,
    imageEditorExportError: LYRA_DEFAULT_imageEditorExportError,
    imageEditorExposure: LYRA_DEFAULT_imageEditorExposure,
    imageEditorFlipX: LYRA_DEFAULT_imageEditorFlipX,
    imageEditorFlipY: LYRA_DEFAULT_imageEditorFlipY,
    imageEditorHighlights: LYRA_DEFAULT_imageEditorHighlights,
    imageEditorLabel: LYRA_DEFAULT_imageEditorLabel,
    imageEditorMonochrome: LYRA_DEFAULT_imageEditorMonochrome,
    imageEditorOriginal: LYRA_DEFAULT_imageEditorOriginal,
    imageEditorPreset: LYRA_DEFAULT_imageEditorPreset,
    imageEditorSaturation: LYRA_DEFAULT_imageEditorSaturation,
    imageEditorShadows: LYRA_DEFAULT_imageEditorShadows,
    imageEditorTint: LYRA_DEFAULT_imageEditorTint,
    imageEditorVibrance: LYRA_DEFAULT_imageEditorVibrance,
    imageEditorVignette: LYRA_DEFAULT_imageEditorVignette,
    imageEditorVivid: LYRA_DEFAULT_imageEditorVivid,
    imageEditorWarmth: LYRA_DEFAULT_imageEditorWarmth,
    imageViewerFailedToLoad: LYRA_DEFAULT_imageViewerFailedToLoad,
    imageViewerRotate: LYRA_DEFAULT_imageViewerRotate,
    loading: LYRA_DEFAULT_loading,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** Image URL. Cross-origin sources must permit anonymous CORS access. */
  @property() src = '';
  /** Accessible description of the image preview. */
  @property() alt = '';

  @state() private settings = defaultEditorSettings();
  @state() private preset: Preset = 'original';
  @state() private showOriginal = false;
  @state() private image?: HTMLImageElement;
  @state() private failed = false;
  @state() private exportFailed = false;
  private readonly announcements = new AnnouncementSinkController(this, { eager: ['assertive'] });
  private readonly previewFrame = new OwnerAnimationFrameWaiter(this);
  private previewQueued = false;

  override connectedCallback(): void {
    super.connectedCallback();
    // A disconnect cancels a queued redraw, so repaint the latest edit on return.
    if (this.hasUpdated && this.image) this.queuePreview();
  }

  override disconnectedCallback(): void {
    this.previewFrame.cancel();
    super.disconnectedCallback();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('src')) {
      this.image = undefined;
      this.failed = false;
      this.exportFailed = false;
      this.settings = defaultEditorSettings();
      this.preset = 'original';
      this.showOriginal = false;
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    // A server-rendered image can finish before hydration attaches its load listener.
    if (changed.has('src') && !this.image && !this.failed) {
      const source = this.renderRoot.querySelector('img');
      if (source?.complete) {
        queueMicrotask(() => {
          if (this.image || this.failed || source.getAttribute('src') !== safeMediaSrc(this.src)) return;
          if (source.naturalWidth > 0) this.image = source;
          else this.loadFailed();
        });
      }
    }
    if (!this.image) return;
    // A new picture paints at once; edits coalesce into one redraw per frame.
    if (changed.has('image')) this.drawPreview();
    else if (changed.has('settings') || changed.has('showOriginal')) this.queuePreview();
  }

  private queuePreview(): void {
    if (this.previewQueued) return;
    this.previewQueued = true;
    void this.previewFrame.wait().then(current => {
      this.previewQueued = false;
      if (current) this.drawPreview();
    });
  }

  private drawPreview(): void {
    const image = this.image;
    const canvas = this.renderRoot.querySelector('canvas');
    if (!image || !canvas) return;
    try {
      renderEditorImage(canvas, image, this.showOriginal ? defaultEditorSettings() : this.settings, 1024);
    } catch {
      queueMicrotask(() => {
        if (this.image === image && image.getAttribute('src') === safeMediaSrc(this.src)) this.loadFailed();
      });
    }
  }

  private currentImage(event: Event): HTMLImageElement | undefined {
    const img = event.currentTarget as HTMLImageElement;
    return img.getAttribute('src') === safeMediaSrc(this.src) && img === this.renderRoot.querySelector('img') ? img : undefined;
  }

  private loadFailed(): void {
    this.image = undefined;
    this.failed = true;
    this.announcements.announceAssertive(this.localize('imageViewerFailedToLoad'));
  }

  /** Encode the current edit at full cropped resolution, including when the original is displayed. */
  async exportBlob(type: string = 'image/png', quality?: number): Promise<Blob> {
    const image = this.image;
    if (!image || image.getAttribute('src') !== safeMediaSrc(this.src)) throw new DOMException('Image unavailable', 'InvalidStateError');
    const canvas = this.ownerDocument.createElement('canvas');
    renderEditorImage(canvas, image, this.settings);
    return new Promise((resolve, reject) => canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new DOMException('Image encoding failed', 'EncodingError')),
      type, quality === undefined ? undefined : finiteRange(quality, 1, 0, 1),
    ));
  }

  private async exportFromControl(): Promise<void> {
    const image = this.image;
    this.exportFailed = false;
    try {
      const blob = await this.exportBlob();
      if (this.isConnected && this.image === image && image?.getAttribute('src') === safeMediaSrc(this.src)) this.emit('lr-export', { blob });
    } catch {
      if (!this.isConnected || this.image !== image) return;
      this.exportFailed = true;
      this.announcements.announceAssertive(this.localize('imageEditorExportError'));
    }
  }

  private setPreset(preset: Preset): void {
    this.preset = preset;
    const { adjustments } = defaultEditorSettings();
    if (preset === 'monochrome') adjustments.saturation = -100;
    if (preset === 'vivid') {
      adjustments.contrast = 15;
      adjustments.vibrance = 40;
    }
    this.settings = { ...this.settings, adjustments };
  }

  private rotate(): void {
    const settings = this.settings;
    // The crop coordinates and flip switches describe the oriented image.
    this.settings = {
      ...settings, turns: (settings.turns + 1) % 4,
      aspect: settings.aspect ? 1 / settings.aspect : 0,
      cropX: 100 - settings.cropY, cropY: settings.cropX,
      flipX: settings.flipY, flipY: settings.flipX,
    };
  }

  private flip(horizontal: boolean): void {
    const settings = this.settings;
    this.settings = horizontal
      ? { ...settings, flipX: !settings.flipX, cropX: 100 - settings.cropX }
      : { ...settings, flipY: !settings.flipY, cropY: 100 - settings.cropY };
  }

  private range(key: Adjustment | CropControl, label: string, value: number, min: number, mirrored = false): TemplateResult {
    const onInput = (event: Event) => {
      const input = (event.currentTarget as HTMLInputElement).valueAsNumber;
      const next = mirrored ? 100 - input : input;
      if (key === 'cropScale' || key === 'cropX' || key === 'cropY') {
        this.settings = { ...this.settings, [key]: next };
      } else {
        this.settings = { ...this.settings, adjustments: { ...this.settings.adjustments, [key]: next } };
        this.preset = 'custom';
      }
    };
    return html`<label><span>${label}</span><input name=${key} type="range" min=${min}
      max="100" .value=${String(mirrored ? 100 - value : value)} @input=${onInput}></label>`;
  }

  override render(): TemplateResult {
    const url = safeMediaSrc(this.src);
    const settings: EditorSettings = this.settings;
    const source = url ? keyed(url, html`<img hidden alt="" crossorigin="anonymous" src=${url}
      @load=${(event: Event) => { const image = this.currentImage(event); if (image && !this.failed) this.image = image; }}
      @error=${(event: Event) => { if (this.currentImage(event)) this.loadFailed(); }}>`) : nothing;
    const unavailable = this.failed || (!!this.src && !url);
    return html`<section part="base" aria-label=${hostAriaLabel(this) ?? this.localize('imageEditorLabel')}>
      ${source}
      ${this.image ? html`<canvas part="preview" role="img" aria-label=${this.alt || this.localize('imageEditorLabel')}></canvas>`
        : html`<p>${unavailable ? this.localize('imageViewerFailedToLoad') : url ? this.localize('loading')
          : this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeImage') })}</p>`}
      ${this.image ? html`<div part="controls">
        <div class="actions">
          <button type="button" aria-pressed=${String(this.showOriginal)} @click=${() => { this.showOriginal = true; }}>${this.localize('imageEditorBefore')}</button>
          <button type="button" aria-pressed=${String(!this.showOriginal)} @click=${() => { this.showOriginal = false; }}>${this.localize('imageEditorAfter')}</button>
        </div>
        <label>${this.localize('imageEditorPreset')}<select name="preset" @change=${(e: Event) => this.setPreset((e.currentTarget as HTMLSelectElement).value as Preset)}>
          <option value="original" .selected=${live(this.preset === 'original')}>${this.localize('imageEditorOriginal')}</option>
          <option value="monochrome" .selected=${live(this.preset === 'monochrome')}>${this.localize('imageEditorMonochrome')}</option>
          <option value="vivid" .selected=${live(this.preset === 'vivid')}>${this.localize('imageEditorVivid')}</option>
          <option value="custom" disabled .selected=${live(this.preset === 'custom')}>${this.localize('imageEditorCustom')}</option>
        </select></label>
        <div class="ranges">${(Object.keys(adjustmentLabels) as Adjustment[]).map(key =>
          this.range(key, this.localize(adjustmentLabels[key]), settings.adjustments[key], key === 'vignette' ? 0 : -100))}</div>
        <label>${this.localize('imageEditorAspect')}<select name="aspect" @change=${(e: Event) => {
          this.settings = { ...this.settings, aspect: Number((e.currentTarget as HTMLSelectElement).value) };
        }}><option value="0" .selected=${live(settings.aspect === 0)}>${this.localize('imageEditorOriginal')}</option>
          ${([[1,1],[4,3],[3,4],[16,9],[9,16]] as const).map(([w,h]) => html`<option value=${w / h} .selected=${live(settings.aspect === w / h)}>${w}:${h}</option>`)}
        </select></label>
        <div class="ranges">
          ${this.range('cropScale', this.localize('imageEditorCropScale'), settings.cropScale, 1)}
          ${this.range('cropX', this.localize('imageEditorCropX'), settings.cropX, 0, this.effectiveDirection === 'rtl')}
          ${this.range('cropY', this.localize('imageEditorCropY'), settings.cropY, 0)}
        </div>
        <div class="actions">
          <button type="button" @click=${this.rotate}>${this.localize('imageViewerRotate')}</button>
          <button type="button" aria-pressed=${String(settings.flipX)} @click=${() => this.flip(true)}>${this.localize('imageEditorFlipX')}</button>
          <button type="button" aria-pressed=${String(settings.flipY)} @click=${() => this.flip(false)}>${this.localize('imageEditorFlipY')}</button>
          <button type="button" @click=${() => { void this.exportFromControl(); }}>${this.localize('imageEditorExport')}</button>
        </div>
        ${this.exportFailed ? html`<p>${this.localize('imageEditorExportError')}</p>` : nothing}
      </div>` : nothing}
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-image-editor': LyraImageEditor;
  }
}
