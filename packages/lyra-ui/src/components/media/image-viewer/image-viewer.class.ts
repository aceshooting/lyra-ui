import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { DocumentAnchorTarget } from '../../../internal/anchor-target.js';
import type {
  LyraAnchor,
  LyraAnchorKind,
  LyraHighlight,
  HighlightActivateDetail,
  AnchorResultDetail,
} from '../../viewers/document-viewer/anchors.js';
import { safeMediaSrc } from '../../../internal/safe-url.js';
import { srOnly } from '../../../internal/a11y.js';
import { finiteNumber } from '../../../internal/numbers.js';
import type { LyraZoomableFrame } from '../zoomable-frame/zoomable-frame.class.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import { chevronIcon } from '../../../internal/icons.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { styles } from './image-viewer.styles.js';

export type ImageFit = 'contain' | 'width' | 'actual';
export type ImageRotation = 0 | 90 | 180 | 270;
export interface ImageRegionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type AnnotationDraft = ImageRegionRect;

type ImageLoadState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'loaded' } | { kind: 'error' };

const MIN_REGION_PERCENT = 2;
const ARROW_STEP_PERCENT = 2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Maps a percent-of-on-screen-box pointer position back to the image's natural (unrotated)
 *  coordinate space. Exact (not an approximation) because `rotation` is constrained to right
 *  angles: a 90/270 rotation of a rectangle is exactly an axis swap with a sign flip, and 180 is
 *  exactly a double sign flip. */
function screenPercentToImagePercent(px: number, py: number, rotation: ImageRotation): { x: number; y: number } {
  switch (rotation) {
    case 90:
      return { x: py, y: 100 - px };
    case 180:
      return { x: 100 - px, y: 100 - py };
    case 270:
      return { x: 100 - py, y: px };
    default:
      return { x: px, y: py };
  }
}

export interface LyraImageViewerEventMap {
  'lr-load': CustomEvent<{ naturalWidth: number; naturalHeight: number }>;
  'lr-zoom-change': CustomEvent<{ zoom: number }>;
  'lr-rotation-change': CustomEvent<{ rotation: ImageRotation }>;
  'lr-fit-change': CustomEvent<{ fit: ImageFit }>;
  'lr-highlight-activate': CustomEvent<HighlightActivateDetail>;
  'lr-annotation-create': CustomEvent<{ anchor: LyraAnchor }>;
  'lr-anchor-result': CustomEvent<AnchorResultDetail>;
  'lr-render-error': CustomEvent<{ error: unknown }>;
}

class LyraImageViewerBase extends LyraElement<LyraImageViewerEventMap> {}

/**
 * `<lr-image-viewer>` — full pan/zoom raster-image viewer with labeled region highlights and
 * opt-in region annotation, the landing surface for `region`-anchored citations. Distinct from
 * `<lr-svg-viewer>` (rendered SVG documents) and `<lr-image-comparer>` (before/after slotted
 * surfaces) — this component owns raster grounding/citation display, not comparison or vector
 * rendering.
 *
 * Adopts `DocumentAnchorTarget` with `anchorKinds: ['region']` only — no text selection is bound
 * (a raster image has no selectable text), so `lr-text-select` is never emitted by this viewer.
 *
 * @customElement lr-image-viewer
 * @slot - None.
 * @event lr-load - Image finished loading. `detail: { naturalWidth, naturalHeight }`.
 * @event lr-zoom-change - `detail: { zoom }`, bubbles from the embedded zoomable-frame.
 * @event lr-rotation-change - `detail: { rotation }`.
 * @event lr-fit-change - `detail: { fit }`.
 * @event lr-highlight-activate - A highlight box was clicked/keyboard-activated. `detail: { id }`.
 * @event lr-annotation-create - A drawn/keyed region was committed. `detail: { anchor }` (kind
 *   `'region'`). Never stored by the component — the host appends a `LyraHighlight`.
 * @event lr-anchor-result - Fired after `anchor` (or a `scrollToAnchor()` call) is applied.
 *   `detail: { found }`.
 * @event lr-render-error - The image failed to load. `detail: { error }`.
 * @csspart base - The root wrapper.
 * @csspart toolbar - The fit/rotate/annotate controls row.
 * @csspart fit-control - The fit-mode select.
 * @csspart rotate-button - The rotate-90-clockwise button.
 * @csspart annotate-toggle - The annotation-mode toggle button.
 * @csspart frame - The embedded `lr-zoomable-frame`.
 * @csspart image-wrapper - The rotated wrapper around the image and its overlays.
 * @csspart image - The `<img>` element.
 * @csspart highlight-layer - The overlay hosting highlight boxes.
 * @csspart highlight - One highlight box (`data-tone`, `data-active`).
 * @csspart highlight-label - A highlight's visible label.
 * @csspart annotation-box - The in-progress draft rectangle.
 * @csspart error - The error region.
 * @cssprop [--lr-image-viewer-annotate-active-bg=var(--lr-color-brand-quiet)] - Background of
 *   `[part="annotate-toggle"]` while annotation mode is on. The toggle carries its own glyph in
 *   `--lr-color-text`, so keep a 4.5:1 ratio against it.
 * @cssprop [--lr-image-viewer-annotate-active-border=var(--lr-color-brand)] - Border color of
 *   `[part="annotate-toggle"]` while annotation mode is on.
 * @cssprop [--lr-image-viewer-highlight-active-color=var(--lr-color-brand)] - Outline color of the
 *   `[part="highlight"]` matching `activeHighlightId`, independent of the per-tone border colors.
 * @cssprop [--lr-image-viewer-highlight-border=var(--lr-color-brand)] - Default highlight border.
 * @cssprop [--lr-image-viewer-highlight-bg=color-mix(in srgb, var(--lr-color-brand) 20%, transparent)] - Default highlight fill.
 * @cssprop --lr-image-viewer-highlight-success-border - Success-tone highlight border.
 * @cssprop --lr-image-viewer-highlight-success-bg - Success-tone highlight fill.
 * @cssprop --lr-image-viewer-highlight-warning-border - Warning-tone highlight border.
 * @cssprop --lr-image-viewer-highlight-warning-bg - Warning-tone highlight fill.
 * @cssprop --lr-image-viewer-highlight-danger-border - Danger-tone highlight border.
 * @cssprop --lr-image-viewer-highlight-danger-bg - Danger-tone highlight fill.
 * @cssprop --lr-image-viewer-highlight-neutral-border - Neutral-tone highlight border.
 * @cssprop --lr-image-viewer-highlight-neutral-bg - Neutral-tone highlight fill.
 */
export class LyraImageViewer extends DocumentAnchorTarget(LyraImageViewerBase) {
  static override styles = [LyraElement.styles, styles, srOnly];

  /** Image URL; validated with `safeMediaSrc` before it ever reaches the `<img>`. */
  @property() src = '';
  /** Accessible name of `[part="base"]`; a host `aria-label` wins, then the localized
   *  `imageViewerLabel` fallback. */
  @property() name = '';
  /** Image alt text. Unset falls back to `name`; explicitly `""` marks the image decorative. */
  @property() alt?: string;
  /** Base scale at `zoom = 1`: `contain` fits the whole image in the frame, `width` fills the
   *  frame's inline size, `actual` shows the image at its natural pixel dimensions. */
  @property({ reflect: true }) fit: ImageFit = 'contain';
  /** Multiplier over the fit-derived base scale, delegated to the embedded zoomable-frame. */
  // numeric-guard-exempt: pure pass-through to <lr-zoomable-frame>, which already normalizes it via its own safeZoom
  @property({ type: Number, reflect: true }) zoom = 1;

  /** Passed through to the embedded `<lr-zoomable-frame>` as `.minZoom`. Same default as
   *  `<lr-zoomable-frame>` itself. Mirrors `<lr-lightbox>`'s own `minZoom` (name, default,
   *  pass-through shape) -- both wrap the exact same `<lr-zoomable-frame>` pan/zoom surface. */
  // numeric-guard-exempt: pure pass-through to <lr-zoomable-frame>, which already normalizes it via its own safeMinZoom
  @property({ type: Number, attribute: 'min-zoom' }) minZoom = 0.5;

  /** Passed through to the embedded `<lr-zoomable-frame>` as `.maxZoom`. Mirrors
   *  `<lr-lightbox>`'s own `maxZoom`. */
  // numeric-guard-exempt: pure pass-through to <lr-zoomable-frame>, which already normalizes it via its own safeMaxZoom
  @property({ type: Number, attribute: 'max-zoom' }) maxZoom = 4;

  /** Passed through to the embedded `<lr-zoomable-frame>` as `.zoomStep`. Mirrors
   *  `<lr-lightbox>`'s own `zoomStep`. */
  // numeric-guard-exempt: pure pass-through to <lr-zoomable-frame>, which already normalizes it via its own safeZoomStep
  @property({ type: Number, attribute: 'zoom-step' }) zoomStep = 0.25;
  /** Clockwise rotation in 90-degree steps. */
  @property({ type: Number, reflect: true }) rotation: ImageRotation = 0;
  /** Enables region drawing via pointer or keyboard. */
  @property({ type: Boolean, reflect: true }) annotatable = false;

  /** From `DocumentAnchorTarget` — only `region` anchors resolve here. */
  override readonly anchorKinds: readonly LyraAnchorKind[] = ['region'];

  @state() private loadState: ImageLoadState = { kind: 'idle' };
  @state() private draft: AnnotationDraft | null = null;

  @query('lr-zoomable-frame') private frameEl?: LyraZoomableFrame;
  @query('lr-live-region') private liveRegion?: LyraLiveRegion;
  @query('[part="image-wrapper"]') private wrapperEl?: HTMLElement;

  /** `rotation` normalized to one of the four right-angle steps this component actually supports
   *  (`0`/`90`/`180`/`270`) -- `rotate()`'s own `% 360` step only ever produces one of these four
   *  values from an already-valid `rotation`, but a directly-assigned `rotation` (attribute or
   *  property) isn't guaranteed to be: a non-finite/negative/non-multiple-of-90 value would
   *  otherwise reach the CSS `rotate(${rotation}deg)` transform and
   *  `screenPercentToImagePercent()`'s right-angle-only coordinate math unnormalized. Rounds to
   *  the nearest right angle, then wraps into `[0, 360)`. */
  private get safeRotation(): ImageRotation {
    const degrees = finiteNumber(this.rotation, 0);
    const steps = Math.round(degrees / 90);
    return ((((steps % 4) + 4) % 4) * 90) as ImageRotation;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed); // reaches DocumentAnchorTarget's own willUpdate (declarative `anchor`)
    if (changed.has('src')) {
      this.cancelPointerDraft();
      this.loadState = this.src && safeMediaSrc(this.src) ? { kind: 'loading' } : this.src ? { kind: 'error' } : { kind: 'idle' };
    }
    if (changed.has('annotatable') && !this.annotatable) this.cancelPointerDraft();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('rotation') && changed.get('rotation') !== undefined) this.emit('lr-rotation-change', { rotation: this.safeRotation });
    if (changed.has('fit') && changed.get('fit') !== undefined) this.emit('lr-fit-change', { fit: this.fit });
    if (changed.has('annotatable') && this.annotatable && changed.get('annotatable') !== undefined) {
      this.liveRegion?.announce(this.localize('imageViewerAnnotationHint'), { force: true });
    }
  }

  zoomIn = (): void => this.frameEl?.zoomIn();
  zoomOut = (): void => this.frameEl?.zoomOut();
  resetZoom = (): void => this.frameEl?.resetZoom();

  rotate(): void {
    this.rotation = ((this.safeRotation + 90) % 360) as ImageRotation;
  }

  protected async applyAnchor(anchor: LyraAnchor): Promise<boolean> {
    // Percent-rect geometry needs no scroll math -- the whole image is already laid out inside
    // the embedded zoomable-frame's viewport. `scrollToAnchor()` (in the mixin) sets
    // `activeHighlightId` for an id-form anchor once this resolves `true`, and `renderHighlights()`
    // reflects that through the `[data-active]` highlight styling.
    return anchor.kind === 'region' && this.loadState.kind === 'loaded';
  }

  private onImgLoad = (event: Event): void => {
    const img = event.target as HTMLImageElement;
    this.loadState = { kind: 'loaded' };
    this.emit('lr-load', { naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
  };

  private onImgError = (): void => {
    this.loadState = { kind: 'error' };
    this.emit('lr-render-error', { error: new Error('The image failed to load.') });
  };

  private onFrameZoomChange = (event: CustomEvent<{ zoom: number }>): void => {
    this.zoom = event.detail.zoom;
  };

  private onHighlightActivate(id: string): void {
    this.activeHighlightId = id;
    this.emit('lr-highlight-activate', { id });
  }

  private toggleAnnotatable = (): void => {
    this.annotatable = !this.annotatable;
  };

  private onFitChange = (event: Event): void => {
    this.fit = (event.target as HTMLSelectElement).value as ImageFit;
  };

  private announceDraftPosition(): void {
    if (!this.draft) return;
    const formatter = getNumberFormat(this.effectiveLocale, {
      maximumFractionDigits: 0,
      useGrouping: false,
    });
    this.liveRegion?.announce(
      this.localize('imageViewerAnnotationBoxPosition', undefined, {
        x: formatter.format(Math.round(this.draft.x)),
        y: formatter.format(Math.round(this.draft.y)),
        width: formatter.format(Math.round(this.draft.width)),
        height: formatter.format(Math.round(this.draft.height)),
      }),
    );
  }

  private onWrapperKeyDown = (event: KeyboardEvent): void => {
    if (!this.annotatable) return;
    if (!this.draft) {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.draft = { x: 37.5, y: 37.5, width: 25, height: 25 };
        this.announceDraftPosition();
      }
      return;
    }
    // Arrow movement here is deliberately physical (x/y), not reading-order: the annotation is a
    // 2-D spatial box over image content, and "left" always means toward smaller x regardless of
    // text direction.
    switch (event.key) {
      // policy-allow(rtl-arrow-keys): moves a 2-D spatial annotation box over image pixels; see above.
      case 'ArrowLeft':
        event.preventDefault();
        if (event.shiftKey) this.draft = { ...this.draft, width: clamp(this.draft.width - ARROW_STEP_PERCENT, MIN_REGION_PERCENT, 100 - this.draft.x) };
        else this.draft = { ...this.draft, x: clamp(this.draft.x - ARROW_STEP_PERCENT, 0, 100 - this.draft.width) };
        break;
      case 'ArrowRight':
        event.preventDefault();
        if (event.shiftKey) this.draft = { ...this.draft, width: clamp(this.draft.width + ARROW_STEP_PERCENT, MIN_REGION_PERCENT, 100 - this.draft.x) };
        else this.draft = { ...this.draft, x: clamp(this.draft.x + ARROW_STEP_PERCENT, 0, 100 - this.draft.width) };
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (event.shiftKey) this.draft = { ...this.draft, height: clamp(this.draft.height - ARROW_STEP_PERCENT, MIN_REGION_PERCENT, 100 - this.draft.y) };
        else this.draft = { ...this.draft, y: clamp(this.draft.y - ARROW_STEP_PERCENT, 0, 100 - this.draft.height) };
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (event.shiftKey) this.draft = { ...this.draft, height: clamp(this.draft.height + ARROW_STEP_PERCENT, MIN_REGION_PERCENT, 100 - this.draft.y) };
        else this.draft = { ...this.draft, y: clamp(this.draft.y + ARROW_STEP_PERCENT, 0, 100 - this.draft.height) };
        break;
      case 'Enter':
        event.preventDefault();
        this.commitDraft();
        return;
      case 'Escape':
        event.preventDefault();
        this.draft = null;
        this.liveRegion?.announce(this.localize('imageViewerAnnotationCancelled'), { force: true });
        return;
      default:
        return;
    }
    this.announceDraftPosition();
  };

  private commitDraft(): void {
    if (!this.draft) return;
    const rect: ImageRegionRect = { x: this.draft.x, y: this.draft.y, width: this.draft.width, height: this.draft.height };
    this.draft = null;
    this.emit<{ anchor: LyraAnchor }>('lr-annotation-create', { anchor: { kind: 'region', rect } });
    this.liveRegion?.announce(this.localize('imageViewerAnnotationAdded'), { force: true });
  }

  private pointerDraftId: number | null = null;
  private pointerOrigin: { x: number; y: number } | null = null;

  private cancelPointerDraft(pointerId = this.pointerDraftId, releaseCapture = true): void {
    // An explicit pointer event may only cancel its own active gesture. Lifecycle/property reset
    // calls use the default value; when no pointer is active they must still clear a
    // keyboard-created draft.
    if (pointerId != null && this.pointerDraftId !== pointerId) return;
    const wrapper = this.wrapperEl;
    const capturedPointerId = this.pointerDraftId;
    this.pointerDraftId = null;
    this.pointerOrigin = null;
    this.draft = null;
    if (releaseCapture && wrapper && capturedPointerId != null) {
      try {
        wrapper.releasePointerCapture(capturedPointerId);
      } catch {
        // Synthetic pointers and already-lost captures can throw; state is still safely cleared.
      }
    }
  }

  private onWrapperPointerDown = (event: PointerEvent): void => {
    if (!this.annotatable || !this.wrapperEl) return;
    const rect = this.wrapperEl.getBoundingClientRect();
    const px = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
    const py = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100);
    const origin = screenPercentToImagePercent(px, py, this.safeRotation);
    this.pointerOrigin = origin;
    this.pointerDraftId = event.pointerId;
    this.wrapperEl.setPointerCapture(event.pointerId);
    this.draft = { x: origin.x, y: origin.y, width: 0, height: 0 };
    event.preventDefault();
  };

  private onWrapperPointerMove = (event: PointerEvent): void => {
    if (this.pointerDraftId !== event.pointerId || !this.pointerOrigin || !this.wrapperEl) return;
    const rect = this.wrapperEl.getBoundingClientRect();
    const px = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
    const py = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100);
    const point = screenPercentToImagePercent(px, py, this.safeRotation);
    const x = Math.min(this.pointerOrigin.x, point.x);
    const y = Math.min(this.pointerOrigin.y, point.y);
    const width = Math.abs(point.x - this.pointerOrigin.x);
    const height = Math.abs(point.y - this.pointerOrigin.y);
    this.draft = { x, y, width, height };
  };

  private onWrapperPointerUp = (event: PointerEvent): void => {
    if (this.pointerDraftId !== event.pointerId) return;
    const draft = this.draft;
    this.cancelPointerDraft(event.pointerId);
    if (draft && draft.width >= MIN_REGION_PERCENT && draft.height >= MIN_REGION_PERCENT) {
      this.draft = draft;
      this.commitDraft();
    }
  };

  private renderHighlights(): TemplateResult | typeof nothing {
    const regionHighlights = this.highlights.filter(
      (h): h is LyraHighlight & { anchor: { kind: 'region'; rect: ImageRegionRect } } => h.anchor.kind === 'region',
    );
    if (!regionHighlights.length) return nothing;
    const formatter = getNumberFormat(this.effectiveLocale, {
      maximumFractionDigits: 0,
      useGrouping: false,
    });
    // Region rects are physical percent-of-image coordinates and the raster underneath never
    // mirrors, so position with physical left/top -- logical inset-inline-start would flip the
    // overlay under RTL while the image stays put. This also keeps the boxes consistent with the
    // pointer math (clientX - rect.left) and the physical-arrow keyboard model above.
    return html`<div part="highlight-layer" role="group" aria-label=${this.localize('imageViewerHighlightsLabel')}>
      ${regionHighlights.map(
        (h, index) => html`
        <button
          part="highlight"
          type="button"
          data-tone=${h.tone ?? 'accent'}
          ?data-active=${this.activeHighlightId === h.id}
          style="left:${h.anchor.rect.x}%;top:${h.anchor.rect.y}%;width:${h.anchor.rect.width}%;height:${h.anchor.rect.height}%"
          aria-label=${h.label || this.localize('imageViewerUnlabeledHighlight', undefined, {
            index: formatter.format(index + 1),
          })}
          @click=${() => this.onHighlightActivate(h.id)}
        >${h.label ? html`<span part="highlight-label">${h.label}</span>` : nothing}</button>
      `,
      )}
    </div>`;
  }

  private renderDraft(): TemplateResult | typeof nothing {
    if (!this.draft) return nothing;
    // Physical left/top for the same reason as renderHighlights(): the draft's x/y come from
    // physical pointer/arrow-key math over a non-mirroring raster.
    return html`<div part="annotation-box" style="left:${this.draft.x}%;top:${this.draft.y}%;width:${this.draft.width}%;height:${this.draft.height}%"></div>`;
  }

  private renderBody(): TemplateResult {
    if (this.loadState.kind === 'error') {
      return html`<div part="error" role="alert">${this.localize('imageViewerFailedToLoad')}</div>`;
    }
    if (this.loadState.kind === 'idle') {
      return html`<p class="empty-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeImage') })}</p>`;
    }
    const safeSrc = safeMediaSrc(this.src);
    return html`<lr-zoomable-frame
      part="frame"
      exportparts="viewport,content,controls"
      .zoom=${this.zoom}
      .minZoom=${this.minZoom}
      .maxZoom=${this.maxZoom}
      .zoomStep=${this.zoomStep}
      @lr-zoom-change=${this.onFrameZoomChange}
    >
      <div
        part="image-wrapper"
        tabindex=${this.annotatable ? '0' : '-1'}
        style="transform:rotate(${this.safeRotation}deg)"
        @keydown=${this.onWrapperKeyDown}
        @pointerdown=${this.onWrapperPointerDown}
        @pointermove=${this.onWrapperPointerMove}
        @pointerup=${this.onWrapperPointerUp}
        @pointercancel=${(event: PointerEvent) => this.cancelPointerDraft(event.pointerId)}
        @lostpointercapture=${(event: PointerEvent) => this.cancelPointerDraft(event.pointerId, false)}
      >
        ${safeSrc
          ? html`<img part="image" data-fit=${this.fit} src=${safeSrc} alt=${this.alt ?? this.name} @load=${this.onImgLoad} @error=${this.onImgError} />`
          : nothing}
        ${this.renderHighlights()}
        ${this.renderDraft()}
      </div>
    </lr-zoomable-frame>`;
  }

  override render(): TemplateResult {
    const label = this.getAttribute('aria-label') || this.name || this.localize('imageViewerLabel');
    return html`<div part="base" role="region" aria-label=${label}>
      <div part="toolbar">
        <span class="fit-control-wrapper">
          <select part="fit-control" aria-label=${this.localize('imageViewerFitLabel')} @change=${this.onFitChange}>
            <option value="contain" ?selected=${this.fit === 'contain'}>${this.localize('imageViewerFitContain')}</option>
            <option value="width" ?selected=${this.fit === 'width'}>${this.localize('imageViewerFitWidth')}</option>
            <option value="actual" ?selected=${this.fit === 'actual'}>${this.localize('imageViewerFitActual')}</option>
          </select>
          <span class="fit-control-chevron" aria-hidden="true">${chevronIcon()}</span>
        </span>
        <button part="rotate-button" type="button" aria-label=${this.localize('imageViewerRotate')} @click=${() => this.rotate()}>&#8635;</button>
        <button part="annotate-toggle" type="button" aria-pressed=${this.annotatable ? 'true' : 'false'} aria-label=${this.localize('imageViewerAnnotate')} @click=${this.toggleAnnotatable}>&#9633;</button>
      </div>
      ${this.renderBody()}
      <lr-live-region></lr-live-region>
      ${this.renderAnchorLiveRegion()}
    </div>`;
  }

  override disconnectedCallback(): void {
    this.cancelPointerDraft();
    super.disconnectedCallback();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-image-viewer': LyraImageViewer;
  }
}
