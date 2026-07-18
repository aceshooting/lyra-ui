import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { DocumentAnchorTarget } from '../../internal/anchor-target.js';
import type {
  LyraAnchor,
  LyraAnchorKind,
  LyraHighlight,
  HighlightActivateDetail,
  AnchorResultDetail,
} from '../document-viewer/anchors.js';
import { safeMediaSrc } from '../../internal/safe-url.js';
import { srOnly } from '../../internal/a11y.js';
import { finiteNumber } from '../../internal/numbers.js';
import type { LyraZoomableFrame } from '../zoomable-frame/zoomable-frame.class.js';
import type { LyraLiveRegion } from '../live-region/live-region.class.js';
import '../zoomable-frame/zoomable-frame.js';
import '../live-region/live-region.js';
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
  'lyra-load': CustomEvent<{ naturalWidth: number; naturalHeight: number }>;
  'lyra-zoom-change': CustomEvent<{ zoom: number }>;
  'lyra-rotation-change': CustomEvent<{ rotation: ImageRotation }>;
  'lyra-fit-change': CustomEvent<{ fit: ImageFit }>;
  'lyra-highlight-activate': CustomEvent<HighlightActivateDetail>;
  'lyra-annotation-create': CustomEvent<{ anchor: LyraAnchor }>;
  'lyra-anchor-result': CustomEvent<AnchorResultDetail>;
  'lyra-render-error': CustomEvent<{ error: unknown }>;
}

class LyraImageViewerBase extends LyraElement<LyraImageViewerEventMap> {}

/**
 * `<lyra-image-viewer>` — full pan/zoom raster-image viewer with labeled region highlights and
 * opt-in region annotation, the landing surface for `region`-anchored citations. Distinct from
 * `<lyra-svg-viewer>` (rendered SVG documents) and `<lyra-image-comparer>` (before/after slotted
 * surfaces) — this component owns raster grounding/citation display, not comparison or vector
 * rendering.
 *
 * Adopts `DocumentAnchorTarget` with `anchorKinds: ['region']` only — no text selection is bound
 * (a raster image has no selectable text), so `lyra-text-select` is never emitted by this viewer.
 *
 * @customElement lyra-image-viewer
 * @slot - None.
 * @event lyra-load - Image finished loading. `detail: { naturalWidth, naturalHeight }`.
 * @event lyra-zoom-change - `detail: { zoom }`, bubbles from the embedded zoomable-frame.
 * @event lyra-rotation-change - `detail: { rotation }`.
 * @event lyra-fit-change - `detail: { fit }`.
 * @event lyra-highlight-activate - A highlight box was clicked/keyboard-activated. `detail: { id }`.
 * @event lyra-annotation-create - A drawn/keyed region was committed. `detail: { anchor }` (kind
 *   `'region'`). Never stored by the component — the host appends a `LyraHighlight`.
 * @event lyra-anchor-result - Fired after `anchor` (or a `scrollToAnchor()` call) is applied.
 *   `detail: { found }`.
 * @event lyra-render-error - The image failed to load. `detail: { error }`.
 * @csspart base - The root wrapper.
 * @csspart toolbar - The fit/rotate/annotate controls row.
 * @csspart fit-control - The fit-mode select.
 * @csspart rotate-button - The rotate-90-clockwise button.
 * @csspart annotate-toggle - The annotation-mode toggle button.
 * @csspart frame - The embedded `lyra-zoomable-frame`.
 * @csspart image-wrapper - The rotated wrapper around the image and its overlays.
 * @csspart image - The `<img>` element.
 * @csspart highlight-layer - The overlay hosting highlight boxes.
 * @csspart highlight - One highlight box (`data-tone`, `data-active`).
 * @csspart highlight-label - A highlight's visible label.
 * @csspart annotation-box - The in-progress draft rectangle.
 * @csspart error - The error region.
 */
export class LyraImageViewer extends DocumentAnchorTarget(LyraImageViewerBase) {
  static styles = [LyraElement.styles, styles, srOnly];

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
  // numeric-guard-exempt: pure pass-through to <lyra-zoomable-frame>, which already normalizes it via its own safeZoom
  @property({ type: Number, reflect: true }) zoom = 1;
  /** Clockwise rotation in 90-degree steps. */
  @property({ type: Number, reflect: true }) rotation: ImageRotation = 0;
  /** Enables region drawing via pointer or keyboard. */
  @property({ type: Boolean, reflect: true }) annotatable = false;

  /** From `DocumentAnchorTarget` — only `region` anchors resolve here. */
  readonly anchorKinds: readonly LyraAnchorKind[] = ['region'];

  @state() private loadState: ImageLoadState = { kind: 'idle' };
  @state() private draft: AnnotationDraft | null = null;

  @query('lyra-zoomable-frame') private frameEl?: LyraZoomableFrame;
  @query('lyra-live-region') private liveRegion?: LyraLiveRegion;
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

  protected willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed); // reaches DocumentAnchorTarget's own willUpdate (declarative `anchor`)
    if (changed.has('src')) {
      this.loadState = this.src && safeMediaSrc(this.src) ? { kind: 'loading' } : this.src ? { kind: 'error' } : { kind: 'idle' };
      this.draft = null;
    }
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('rotation') && changed.get('rotation') !== undefined) this.emit('lyra-rotation-change', { rotation: this.safeRotation });
    if (changed.has('fit') && changed.get('fit') !== undefined) this.emit('lyra-fit-change', { fit: this.fit });
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
    this.emit('lyra-load', { naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
  };

  private onImgError = (): void => {
    this.loadState = { kind: 'error' };
    this.emit('lyra-render-error', { error: new Error('The image failed to load.') });
  };

  private onFrameZoomChange = (event: CustomEvent<{ zoom: number }>): void => {
    this.zoom = event.detail.zoom;
  };

  private onHighlightActivate(id: string): void {
    this.activeHighlightId = id;
    this.emit('lyra-highlight-activate', { id });
  }

  private toggleAnnotatable = (): void => {
    this.annotatable = !this.annotatable;
  };

  private onFitChange = (event: Event): void => {
    this.fit = (event.target as HTMLSelectElement).value as ImageFit;
  };

  private announceDraftPosition(): void {
    if (!this.draft) return;
    this.liveRegion?.announce(
      this.localize('imageViewerAnnotationBoxPosition', undefined, {
        x: Math.round(this.draft.x),
        y: Math.round(this.draft.y),
        width: Math.round(this.draft.width),
        height: Math.round(this.draft.height),
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
    this.emit<{ anchor: LyraAnchor }>('lyra-annotation-create', { anchor: { kind: 'region', rect } });
    this.liveRegion?.announce(this.localize('imageViewerAnnotationAdded'), { force: true });
  }

  private pointerDraftId: number | null = null;
  private pointerOrigin: { x: number; y: number } | null = null;

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
    this.pointerDraftId = null;
    this.pointerOrigin = null;
    if (this.draft && this.draft.width >= MIN_REGION_PERCENT && this.draft.height >= MIN_REGION_PERCENT) {
      this.commitDraft();
    } else {
      this.draft = null;
    }
  };

  private renderHighlights(): TemplateResult | typeof nothing {
    const regionHighlights = this.highlights.filter(
      (h): h is LyraHighlight & { anchor: { kind: 'region'; rect: ImageRegionRect } } => h.anchor.kind === 'region',
    );
    if (!regionHighlights.length) return nothing;
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
          aria-label=${h.label || this.localize('imageViewerUnlabeledHighlight', undefined, { index: index + 1 })}
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
    return html`<lyra-zoomable-frame part="frame" exportparts="viewport,content,controls" .zoom=${this.zoom} @lyra-zoom-change=${this.onFrameZoomChange}>
      <div
        part="image-wrapper"
        tabindex=${this.annotatable ? '0' : '-1'}
        style="transform:rotate(${this.safeRotation}deg)"
        @keydown=${this.onWrapperKeyDown}
        @pointerdown=${this.onWrapperPointerDown}
        @pointermove=${this.onWrapperPointerMove}
        @pointerup=${this.onWrapperPointerUp}
      >
        ${safeSrc
          ? html`<img part="image" data-fit=${this.fit} src=${safeSrc} alt=${this.alt ?? this.name} @load=${this.onImgLoad} @error=${this.onImgError} />`
          : nothing}
        ${this.renderHighlights()}
        ${this.renderDraft()}
      </div>
    </lyra-zoomable-frame>`;
  }

  render(): TemplateResult {
    const label = this.getAttribute('aria-label') || this.name || this.localize('imageViewerLabel');
    return html`<div part="base" aria-label=${label}>
      <div part="toolbar">
        <select part="fit-control" aria-label=${this.localize('imageViewerFitLabel')} @change=${this.onFitChange}>
          <option value="contain" ?selected=${this.fit === 'contain'}>${this.localize('imageViewerFitContain')}</option>
          <option value="width" ?selected=${this.fit === 'width'}>${this.localize('imageViewerFitWidth')}</option>
          <option value="actual" ?selected=${this.fit === 'actual'}>${this.localize('imageViewerFitActual')}</option>
        </select>
        <button part="rotate-button" type="button" aria-label=${this.localize('imageViewerRotate')} @click=${() => this.rotate()}>&#8635;</button>
        <button part="annotate-toggle" type="button" aria-pressed=${this.annotatable ? 'true' : 'false'} aria-label=${this.localize('imageViewerAnnotate')} @click=${this.toggleAnnotatable}>&#9633;</button>
      </div>
      ${this.renderBody()}
      <lyra-live-region></lyra-live-region>
      ${this.renderAnchorLiveRegion()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-image-viewer': LyraImageViewer;
  }
}
