import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { keyed } from 'lit/directives/keyed.js';
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
import { hostAriaLabel, srOnly } from '../../../internal/a11y.js';
import { finiteNumber } from '../../../internal/numbers.js';
import type { LyraPanZoom } from '../pan-zoom/pan-zoom.class.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import { chevronIcon } from '../../../internal/icons.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { styles } from './image-viewer.styles.js';
import { sanitizePercentRect, type SafePercentRect } from '../../../internal/safe-css.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound, LYRA_DEFAULT_documentPreviewEmpty, LYRA_DEFAULT_documentPreviewTypeImage, LYRA_DEFAULT_imageViewerAnnotate, LYRA_DEFAULT_imageViewerAnnotationAdded, LYRA_DEFAULT_imageViewerAnnotationBoxPosition, LYRA_DEFAULT_imageViewerAnnotationCancelled, LYRA_DEFAULT_imageViewerAnnotationHint, LYRA_DEFAULT_imageViewerFailedToLoad, LYRA_DEFAULT_imageViewerFitActual, LYRA_DEFAULT_imageViewerFitContain, LYRA_DEFAULT_imageViewerFitLabel, LYRA_DEFAULT_imageViewerFitWidth, LYRA_DEFAULT_imageViewerHighlightsLabel, LYRA_DEFAULT_imageViewerLabel, LYRA_DEFAULT_imageViewerRotate, LYRA_DEFAULT_imageViewerUnlabeledHighlight } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type LyraImageFit = 'contain' | 'width' | 'actual';
export type LyraImageRotation = 0 | 90 | 180 | 270;
/** Finite percentage coordinates. Negative widths/heights are rejected when rendered. */
export interface LyraImageRegionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type AnnotationDraft = LyraImageRegionRect;

type ImageLoadState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'loaded' } | { kind: 'error' };

const MIN_REGION_PERCENT = 2;
const ARROW_STEP_PERCENT = 2;
/** Maximum region buttons projected at once. An active region beyond the leading window replaces
 * the final entry so anchor identity remains reachable without making an unbounded tab/DOM list. */
export const IMAGE_VIEWER_HIGHLIGHT_LIMIT = 200;
const IMAGE_FITS = new Set<LyraImageFit>(['contain', 'width', 'actual']);

function normalizeImageFit(value: unknown): LyraImageFit {
  return IMAGE_FITS.has(value as LyraImageFit) ? value as LyraImageFit : 'contain';
}

function normalizeImageRotation(value: unknown): LyraImageRotation {
  const degrees = typeof value === 'number' ? finiteNumber(value, 0) : 0;
  const steps = Math.round(degrees / 90);
  return ((((steps % 4) + 4) % 4) * 90) as LyraImageRotation;
}

function normalizeImageRegionRect(value: unknown): SafePercentRect | undefined {
  const rect = sanitizePercentRect(value);
  if (
    !rect ||
    rect.x < 0 ||
    rect.y < 0 ||
    rect.width <= 0 ||
    rect.height <= 0 ||
    rect.x + rect.width > 100 ||
    rect.y + rect.height > 100
  ) return undefined;
  return rect;
}

function normalizeHighlightTone(value: unknown): 'accent' | 'success' | 'warning' | 'danger' | 'neutral' {
  return value === 'success' || value === 'warning' || value === 'danger' || value === 'neutral'
    ? value
    : 'accent';
}

interface NormalizedRegionHighlight {
  highlight: LyraHighlight;
  rect: SafePercentRect;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Maps a percent-of-on-screen-box pointer position back to the image's natural (unrotated)
 *  coordinate space. Exact (not an approximation) because `rotation` is constrained to right
 *  angles: a 90/270 rotation of a rectangle is exactly an axis swap with a sign flip, and 180 is
 *  exactly a double sign flip. */
function screenPercentToImagePercent(px: number, py: number, rotation: LyraImageRotation): { x: number; y: number } {
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
  'lr-rotation-change': CustomEvent<{ rotation: LyraImageRotation }>;
  'lr-fit-change': CustomEvent<{ fit: LyraImageFit }>;
  'lr-highlight-activate': CustomEvent<HighlightActivateDetail>;
  'lr-annotation-create': CustomEvent<LyraEventDetailSnapshot<{ anchor: LyraAnchor }>>;
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
 * Region rectangles are canonical finite, positive percentages wholly inside the 0–100 image
 * space; empty/blank IDs are omitted and duplicates use first-wins uniqueness. At most
 * `IMAGE_VIEWER_HIGHLIGHT_LIMIT` buttons are
 * projected at once with one roving tab stop. An active tail item remains reachable by replacing
 * the final item in the leading window. Anchor success means the canonical rendered target was
 * scrolled into and visibly intersects the embedded viewport.
 *
 * Fit, rotation, and annotation controls become operable only after the current image loads. At
 * 90°/270° the `rotation-frame` owns an axis-swapped layout footprint so transformed media stays
 * reachable in every fit mode rather than painting outside the pan/zoom scroll geometry.
 *
 * **RTL behavior:** the raster and annotation geometry use physical image coordinates. In
 * annotation mode, ArrowLeft/ArrowRight decrease/increase a draft's x coordinate and their Shift
 * variants decrease/increase its width in both text directions; the surrounding toolbar remains
 * logical.
 *
 * @customElement lr-image-viewer
 * @event lr-load - Image finished loading. `detail: { naturalWidth, naturalHeight }`.
 * @event lr-zoom-change - `detail: { zoom }`, bubbles from the embedded pan-zoom surface.
 * @event lr-rotation-change - `detail: { rotation }`.
 * @event lr-fit-change - `detail: { fit }`.
 * @event lr-highlight-activate - A highlight box was clicked/keyboard-activated.
 *   `detail: { highlightId }`.
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
 * @csspart frame - The embedded `lr-pan-zoom`.
 * @csspart frame-viewport - The embedded pan-zoom's scrollable viewport.
 * @csspart frame-content - The embedded pan-zoom's transformed content wrapper.
 * @csspart frame-controls - The embedded pan-zoom's zoom controls.
 * @csspart rotation-frame - Layout footprint that axis-swaps at 90/270 degrees.
 * @csspart image-wrapper - The rotated wrapper around the image and its overlays.
 * @csspart image - The `<img>` element.
 * @csspart highlight-layer - The overlay hosting highlight boxes.
 * @csspart highlight - One highlight box (`data-tone`, `data-active`).
 * @csspart highlight-label - A highlight's visible label.
 * @csspart annotation-box - The in-progress draft rectangle.
 * @csspart error - Ordinary visible failure text. Fresh post-mount image/source failures append
 *   the localized message to the shared light-DOM assertive announcement sink; an already-unsafe
 *   initial `src` renders visibly without interrupting on mount.
 * @cssprop [--lr-image-viewer-annotate-active-bg=var(--lr-color-brand-quiet)] - Background of
 *   `[part="annotate-toggle"]` while annotation mode is on. The toggle carries its own glyph in
 *   `--lr-color-text`, so keep a 4.5:1 ratio against it.
 * @cssprop [--lr-image-viewer-annotate-active-border=var(--lr-color-brand)] - Border color of
 *   `[part="annotate-toggle"]` while annotation mode is on.
 * @cssprop [--lr-image-viewer-highlight-active-color=var(--lr-color-brand)] - Outline color of the
 *   `[part="highlight"]` matching `activeHighlightId`, independent of the per-tone border colors.
 * @cssprop [--lr-image-viewer-highlight-active-border-width=var(--lr-border-width-thick)] - Border
 *   width of the `[part="highlight"]` matching `activeHighlightId`.
 * @cssprop [--lr-image-viewer-highlight-active-outline-width=var(--lr-focus-ring-width)] - Outline
 *   width of the `[part="highlight"]` matching `activeHighlightId`.
 * @cssprop [--lr-image-viewer-highlight-active-outline-offset=var(--lr-focus-ring-offset)] - Outline
 *   offset of the `[part="highlight"]` matching `activeHighlightId`.
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
 * @cssprop --lr-image-viewer-highlight-fill - The resting fill a `[part="highlight"]` actually
 *   renders, resolved per tone from the `--lr-image-viewer-highlight-*-bg` knobs above. Its hover
 *   and pressed states are colour mixes taken from this value, so setting it directly retints all
 *   three at once for one highlight; retint a whole tone through the `-bg` knob instead.
 * @status stable
 * @since 4.0.0
 */
export class LyraImageViewer extends DocumentAnchorTarget(LyraImageViewerBase) {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    anchorJumped: LYRA_DEFAULT_anchorJumped,
    anchorJumpedToPage: LYRA_DEFAULT_anchorJumpedToPage,
    anchorNotFound: LYRA_DEFAULT_anchorNotFound,
    documentPreviewEmpty: LYRA_DEFAULT_documentPreviewEmpty,
    documentPreviewTypeImage: LYRA_DEFAULT_documentPreviewTypeImage,
    imageViewerAnnotate: LYRA_DEFAULT_imageViewerAnnotate,
    imageViewerAnnotationAdded: LYRA_DEFAULT_imageViewerAnnotationAdded,
    imageViewerAnnotationBoxPosition: LYRA_DEFAULT_imageViewerAnnotationBoxPosition,
    imageViewerAnnotationCancelled: LYRA_DEFAULT_imageViewerAnnotationCancelled,
    imageViewerAnnotationHint: LYRA_DEFAULT_imageViewerAnnotationHint,
    imageViewerFailedToLoad: LYRA_DEFAULT_imageViewerFailedToLoad,
    imageViewerFitActual: LYRA_DEFAULT_imageViewerFitActual,
    imageViewerFitContain: LYRA_DEFAULT_imageViewerFitContain,
    imageViewerFitLabel: LYRA_DEFAULT_imageViewerFitLabel,
    imageViewerFitWidth: LYRA_DEFAULT_imageViewerFitWidth,
    imageViewerHighlightsLabel: LYRA_DEFAULT_imageViewerHighlightsLabel,
    imageViewerLabel: LYRA_DEFAULT_imageViewerLabel,
    imageViewerRotate: LYRA_DEFAULT_imageViewerRotate,
    imageViewerUnlabeledHighlight: LYRA_DEFAULT_imageViewerUnlabeledHighlight,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, srOnly];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-annotation-create',
  ]);

  /** Image URL; validated with `safeMediaSrc` before it ever reaches the `<img>`. */
  @property() src = '';
  /** Accessible name of `[part="base"]`; a host `aria-label` wins, then the localized
   *  `imageViewerLabel` fallback. */
  @property() name = '';
  /** Image alt text. Unset falls back to `name`; explicitly `""` marks the image decorative. */
  @property() alt?: string;
  /** Base scale at `zoom = 1`: `contain` fits the whole image in the frame, `width` fills the
   *  frame's inline size, `actual` shows the image at its natural pixel dimensions. */
  private _fit: LyraImageFit = 'contain';
  @property({ reflect: true })
  get fit(): LyraImageFit {
    return this._fit;
  }
  set fit(value: LyraImageFit) {
    const old = this._fit;
    this._fit = normalizeImageFit(value);
    this.requestUpdate('fit', old);
  }
  /** Multiplier over the fit-derived base scale, delegated to the embedded pan-zoom surface. */
  // numeric-guard-exempt: pure pass-through to <lr-pan-zoom>, which already normalizes it via its own safeZoom
  @property({ type: Number, reflect: true }) zoom = 1;

  /** Passed through to the embedded `<lr-pan-zoom>` as `.minZoom`. Same default as
   *  `<lr-pan-zoom>` itself. Mirrors `<lr-lightbox>`'s own `minZoom` (name, default,
   *  pass-through shape) -- both wrap the exact same `<lr-pan-zoom>` surface. */
  // numeric-guard-exempt: pure pass-through to <lr-pan-zoom>, which already normalizes it via its own safeMinZoom
  @property({ type: Number, attribute: 'min-zoom' }) minZoom = 0.5;

  /** Passed through to the embedded `<lr-pan-zoom>` as `.maxZoom`. Mirrors
   *  `<lr-lightbox>`'s own `maxZoom`. */
  // numeric-guard-exempt: pure pass-through to <lr-pan-zoom>, which already normalizes it via its own safeMaxZoom
  @property({ type: Number, attribute: 'max-zoom' }) maxZoom = 4;

  /** Passed through to the embedded `<lr-pan-zoom>` as `.zoomStep`. Mirrors
   *  `<lr-lightbox>`'s own `zoomStep`. */
  // numeric-guard-exempt: pure pass-through to <lr-pan-zoom>, which already normalizes it via its own safeZoomStep
  @property({ type: Number, attribute: 'zoom-step' }) zoomStep = 0.25;
  /** Clockwise rotation in 90-degree steps. */
  private _rotation: LyraImageRotation = 0;
  // numeric-guard-exempt: the setter immediately normalizes every write with finiteNumber and a bounded four-step wrap
  @property({ type: Number, reflect: true })
  get rotation(): LyraImageRotation {
    return this._rotation;
  }
  set rotation(value: LyraImageRotation) {
    const old = this._rotation;
    this._rotation = normalizeImageRotation(value);
    this.requestUpdate('rotation', old);
  }
  /** Enables region drawing via pointer or keyboard. */
  @property({ type: Boolean, reflect: true }) annotatable = false;

  /** From `DocumentAnchorTarget` — only `region` anchors resolve here. */
  override readonly anchorKinds: readonly LyraAnchorKind[] = ['region'];

  @state() private loadState: ImageLoadState = { kind: 'idle' };
  @state() private draft: AnnotationDraft | null = null;
  @state() private revealTarget: SafePercentRect | null = null;
  @state() private highlightFocusId: string | null = null;
  @state() private mediaLayoutSize: { width: number; height: number } | null = null;
  private errorAnnouncementSink?: AnnouncementSink;
  private geometryObserver?: ResizeObserver;
  private observedWrapper?: HTMLElement;
  private geometryFrame?: number;
  private geometryFrameOwner?: Window;

  @query('lr-pan-zoom') private frameEl?: LyraPanZoom;
  @query('lr-live-region') private liveRegion?: LyraLiveRegion;
  @query('[part="image-wrapper"]') private wrapperEl?: HTMLElement;

  /** `rotation` normalized to one of the four right-angle steps this component actually supports
   *  (`0`/`90`/`180`/`270`) -- `rotate()`'s own `% 360` step only ever produces one of these four
   *  values from an already-valid `rotation`, but a directly-assigned `rotation` (attribute or
   *  property) isn't guaranteed to be: a non-finite/negative/non-multiple-of-90 value would
   *  otherwise reach the CSS `rotate(${rotation}deg)` transform and
   *  `screenPercentToImagePercent()`'s right-angle-only coordinate math unnormalized. Rounds to
   *  the nearest right angle, then wraps into `[0, 360)`. */
  private get safeRotation(): LyraImageRotation {
    return this.rotation;
  }

  private get hasOperableContent(): boolean {
    return this.loadState.kind === 'loaded';
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed); // reaches DocumentAnchorTarget's own willUpdate (declarative `anchor`)
    if (changed.has('src')) {
      this.cancelPointerDraft();
      this.revealTarget = null;
      this.mediaLayoutSize = null;
      const safeSrc = this.src ? safeMediaSrc(this.src) : null;
      this.loadState = safeSrc ? { kind: 'loading' } : this.src ? { kind: 'error' } : { kind: 'idle' };
      if (this.hasUpdated && this.src && !safeSrc) this.announceLoadError();
    }
    if (changed.has('annotatable') && (!this.annotatable || !this.hasOperableContent)) {
      this.cancelPointerDraft();
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('rotation') && changed.get('rotation') !== undefined) this.emit('lr-rotation-change', { rotation: this.safeRotation });
    if (changed.has('fit') && changed.get('fit') !== undefined) this.emit('lr-fit-change', { fit: this.fit });
    if (
      (changed.has('annotatable') || changed.has('loadState')) &&
      this.annotatable &&
      this.hasOperableContent &&
      (changed.has('loadState') || changed.get('annotatable') !== undefined)
    ) {
      this.liveRegion?.announce(this.localize('imageViewerAnnotationHint'), { force: true });
    }
    this.syncGeometryObserver();
  }

  /** Increases the embedded pan/zoom scale by one configured step. */
  zoomIn: () => void = (): void => this.frameEl?.zoomIn();
  /** Decreases the embedded pan/zoom scale by one configured step. */
  zoomOut: () => void = (): void => this.frameEl?.zoomOut();
  /** Restores the embedded pan/zoom scale and translation. */
  resetZoom: () => void = (): void => this.frameEl?.resetZoom();

  rotate(): void {
    this.rotation = ((this.safeRotation + 90) % 360) as LyraImageRotation;
  }

  protected async applyAnchor(anchor: LyraAnchor): Promise<boolean> {
    if (anchor.kind !== 'region' || !this.hasOperableContent) return false;
    const rect = normalizeImageRegionRect(anchor.rect);
    if (!rect) return false;
    this.revealTarget = rect;
    await this.updateComplete;
    const target = this.shadowRoot?.querySelector<HTMLElement>('[data-reveal-target]');
    const viewport = this.frameEl?.shadowRoot?.querySelector<HTMLElement>('[part="viewport"]');
    if (!target || !viewport || target.getClientRects().length === 0) return false;
    target.scrollIntoView({ block: 'center', inline: 'center' });
    await new Promise<void>((resolve) => {
      const view = this.ownerDocument.defaultView;
      if (view) view.requestAnimationFrame(() => resolve());
      else resolve();
    });
    const targetRect = target.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    return targetRect.right > viewportRect.left &&
      targetRect.left < viewportRect.right &&
      targetRect.bottom > viewportRect.top &&
      targetRect.top < viewportRect.bottom;
  }

  private onImgLoad = (event: Event): void => {
    const img = event.target as HTMLImageElement;
    if (img !== this.shadowRoot?.querySelector('[part="image"]')) return;
    this.loadState = { kind: 'loaded' };
    this.emit('lr-load', { naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
  };

  private onImgError = (event: Event): void => {
    if (event.target !== this.shadowRoot?.querySelector('[part="image"]')) return;
    this.cancelPointerDraft();
    this.revealTarget = null;
    this.loadState = { kind: 'error' };
    this.announceLoadError();
    this.emit('lr-render-error', { error: new Error('The image failed to load.') });
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncErrorAnnouncementSink();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.disconnectGeometryObserver();
    this.releaseErrorAnnouncementSink();
    this.syncErrorAnnouncementSink();
    this.scheduleAfterUpdate(() => this.syncGeometryObserver());
  }

  private disconnectGeometryObserver(): void {
    this.geometryObserver?.disconnect();
    this.geometryObserver = undefined;
    this.observedWrapper = undefined;
    if (this.geometryFrame !== undefined) this.geometryFrameOwner?.cancelAnimationFrame(this.geometryFrame);
    this.geometryFrame = undefined;
    this.geometryFrameOwner = undefined;
  }

  private updateMediaLayoutSize(width: number, height: number): void {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
    if (this.mediaLayoutSize?.width === width && this.mediaLayoutSize.height === height) return;
    this.mediaLayoutSize = { width, height };
  }

  private scheduleMediaLayoutSize(width: number, height: number): void {
    const view = this.ownerDocument.defaultView;
    if (!view) {
      this.updateMediaLayoutSize(width, height);
      return;
    }
    if (this.geometryFrame !== undefined) this.geometryFrameOwner?.cancelAnimationFrame(this.geometryFrame);
    this.geometryFrameOwner = view;
    this.geometryFrame = view.requestAnimationFrame(() => {
      this.geometryFrame = undefined;
      this.geometryFrameOwner = undefined;
      this.updateMediaLayoutSize(Math.round(width * 100) / 100, Math.round(height * 100) / 100);
    });
  }

  private syncGeometryObserver(): void {
    const wrapper = this.wrapperEl;
    if (wrapper === this.observedWrapper) return;
    this.disconnectGeometryObserver();
    if (!wrapper) return;
    this.observedWrapper = wrapper;
    this.scheduleMediaLayoutSize(wrapper.offsetWidth, wrapper.offsetHeight);
    const ResizeObserverConstructor = this.ownerDocument.defaultView?.ResizeObserver;
    if (!ResizeObserverConstructor) return;
    this.geometryObserver = new ResizeObserverConstructor((entries) => {
      const entry = entries.find((candidate) => candidate.target === this.observedWrapper);
      if (entry) this.scheduleMediaLayoutSize(entry.contentRect.width, entry.contentRect.height);
    });
    this.geometryObserver.observe(wrapper);
  }

  private syncErrorAnnouncementSink(): void {
    if (!this.isConnected) return;
    if (this.errorAnnouncementSink?.element.ownerDocument === this.ownerDocument) return;
    this.releaseErrorAnnouncementSink();
    this.errorAnnouncementSink = acquireAnnouncementSink('assertive', {
      document: this.ownerDocument,
      source: this,
    });
  }

  private releaseErrorAnnouncementSink(): void {
    this.errorAnnouncementSink?.release();
    this.errorAnnouncementSink = undefined;
  }

  private announceLoadError(): void {
    this.errorAnnouncementSink?.announce(this.localize('imageViewerFailedToLoad'));
  }

  private onFrameZoomChange = (event: CustomEvent<{ zoom: number }>): void => {
    this.zoom = event.detail.zoom;
  };

  private onHighlightActivate(id: string): void {
    this.activeHighlightId = id;
    this.emit('lr-highlight-activate', { highlightId: id });
  }

  private toggleAnnotatable = (): void => {
    if (!this.hasOperableContent) return;
    this.annotatable = !this.annotatable;
  };

  private onFitChange = (event: Event): void => {
    this.fit = (event.target as HTMLSelectElement).value as LyraImageFit;
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
    if (!this.annotatable || !this.hasOperableContent) return;
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
    const rect: LyraImageRegionRect = { x: this.draft.x, y: this.draft.y, width: this.draft.width, height: this.draft.height };
    this.draft = null;
    this.emit('lr-annotation-create', { anchor: { kind: 'region', rect } });
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
    if (!this.annotatable || !this.hasOperableContent || !this.wrapperEl) return;
    // Only the primary button starts a drag. A secondary/middle press has to stay free for the
    // context menu and must not capture the pointer or leave a draft box behind, which it would
    // otherwise do with no matching pointerup path to clear it.
    if (!event.isPrimary || event.button !== 0 || this.pointerDraftId !== null) return;
    const rect = this.wrapperEl.getBoundingClientRect();
    const px = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
    const py = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100);
    const origin = screenPercentToImagePercent(px, py, this.safeRotation);
    this.pointerOrigin = origin;
    this.pointerDraftId = event.pointerId;
    try {
      this.wrapperEl.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic events have no active browser pointer to capture; their explicit terminal event
      // still clears the same identity-keyed gesture state.
    }
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

  private canonicalRegionHighlights(): NormalizedRegionHighlight[] {
    const ids = new Set<string>();
    const result: NormalizedRegionHighlight[] = [];
    for (const highlight of this.highlights) {
      if (!highlight || typeof highlight.id !== 'string' || highlight.id.trim().length === 0 || ids.has(highlight.id)) continue;
      if (highlight.anchor.kind !== 'region') continue;
      const rect = normalizeImageRegionRect(highlight.anchor.rect);
      if (!rect) continue;
      ids.add(highlight.id);
      result.push({ highlight, rect });
    }
    return result;
  }

  private boundedRegionHighlights(): {
    all: NormalizedRegionHighlight[];
    visible: NormalizedRegionHighlight[];
  } {
    const all = this.canonicalRegionHighlights();
    if (all.length <= IMAGE_VIEWER_HIGHLIGHT_LIMIT) return { all, visible: all };
    const visible = all.slice(0, IMAGE_VIEWER_HIGHLIGHT_LIMIT);
    const active = this.activeHighlightId
      ? all.find((entry) => entry.highlight.id === this.activeHighlightId)
      : undefined;
    if (active && !visible.includes(active)) visible[visible.length - 1] = active;
    return { all, visible };
  }

  private onHighlightFocus(id: string): void {
    this.highlightFocusId = id;
  }

  private onHighlightKeyDown(event: KeyboardEvent, id: string): void {
    const buttons = [...this.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="highlight"]')];
    if (buttons.length < 2) return;
    const current = buttons.findIndex((button) => button.dataset['highlightId'] === id);
    const rtl = this.effectiveDirection === 'rtl';
    let next = current;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = buttons.length - 1;
    else if (event.key === 'ArrowDown' || event.key === (rtl ? 'ArrowLeft' : 'ArrowRight')) {
      next = (current + 1) % buttons.length;
    } else if (event.key === 'ArrowUp' || event.key === (rtl ? 'ArrowRight' : 'ArrowLeft')) {
      next = (current - 1 + buttons.length) % buttons.length;
    } else return;
    event.preventDefault();
    const target = buttons[next]!;
    this.highlightFocusId = target.dataset['highlightId'] ?? null;
    target.focus();
    this.requestUpdate();
  }

  private renderHighlights(): TemplateResult | typeof nothing {
    if (!this.hasOperableContent) return nothing;
    const { all: regionHighlights, visible } = this.boundedRegionHighlights();
    if (!regionHighlights.length) return nothing;
    const formatter = getNumberFormat(this.effectiveLocale, {
      maximumFractionDigits: 0,
      useGrouping: false,
    });
    // Region rects are physical percent-of-image coordinates and the raster underneath never
    // mirrors, so position with physical left/top -- logical inset-inline-start would flip the
    // overlay under RTL while the image stays put. This also keeps the boxes consistent with the
    // pointer math (clientX - rect.left) and the physical-arrow keyboard model above.
    const preferredFocusId = visible.some(({ highlight }) => highlight.id === this.highlightFocusId)
      ? this.highlightFocusId
      : visible.some(({ highlight }) => highlight.id === this.activeHighlightId)
        ? this.activeHighlightId
        : visible[0]?.highlight.id ?? null;
    return html`<div
      part="highlight-layer"
      role="group"
      aria-label=${this.localize('imageViewerHighlightsLabel')}
      ?data-truncated=${regionHighlights.length > visible.length}
      data-total=${String(regionHighlights.length)}
    >
      ${visible.map(
        ({ highlight: h, rect }, index) => html`
        <button
          part="highlight"
          type="button"
          data-highlight-id=${h.id}
          data-tone=${normalizeHighlightTone(h.tone)}
          ?data-active=${this.activeHighlightId === h.id}
          tabindex=${preferredFocusId === h.id ? '0' : '-1'}
          style=${styleMap({
            left: `${rect.x}%`,
            top: `${rect.y}%`,
            width: `${rect.width}%`,
            height: `${rect.height}%`,
          })}
          aria-label=${h.label || this.localize('imageViewerUnlabeledHighlight', undefined, {
            index: formatter.format(index + 1),
          })}
          @click=${() => this.onHighlightActivate(h.id)}
          @focus=${() => this.onHighlightFocus(h.id)}
          @keydown=${(event: KeyboardEvent) => this.onHighlightKeyDown(event, h.id)}
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

  private renderRevealTarget(): TemplateResult | typeof nothing {
    const rect = this.revealTarget;
    if (!rect) return nothing;
    return html`<span
      class="reveal-target"
      data-reveal-target
      aria-hidden="true"
      style=${styleMap({
        left: `${rect.x}%`,
        top: `${rect.y}%`,
        width: `${rect.width}%`,
        height: `${rect.height}%`,
      })}
    ></span>`;
  }

  private renderBody(): TemplateResult {
    if (this.loadState.kind === 'error') {
      return html`<div part="error">${this.localize('imageViewerFailedToLoad')}</div>`;
    }
    if (this.loadState.kind === 'idle') {
      return html`<p class="empty-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeImage') })}</p>`;
    }
    const safeSrc = safeMediaSrc(this.src);
    const swapped = this.safeRotation === 90 || this.safeRotation === 270;
    const layout = this.mediaLayoutSize;
    const rotationFrameStyle = layout
      ? styleMap({
        width: `${swapped ? layout.height : layout.width}px`,
        height: `${swapped ? layout.width : layout.height}px`,
      })
      : nothing;
    const effectiveAnnotatable = this.annotatable && this.hasOperableContent;
    return html`<lr-pan-zoom
      part="frame"
      exportparts="viewport:frame-viewport,content:frame-content,controls:frame-controls"
      .zoom=${this.zoom}
      .minZoom=${this.minZoom}
      .maxZoom=${this.maxZoom}
      .zoomStep=${this.zoomStep}
      @lr-zoom-change=${this.onFrameZoomChange}
      @focus=${(event: Event) => event.stopPropagation()}
      @blur=${(event: Event) => event.stopPropagation()}
      @lr-focus=${(event: Event) => event.stopPropagation()}
      @lr-blur=${(event: Event) => event.stopPropagation()}
    >
      <div
        part="rotation-frame"
        data-rotation=${String(this.safeRotation)}
        ?data-measured=${layout !== null}
        style=${rotationFrameStyle}
      >
        <div
          part="image-wrapper"
          tabindex=${effectiveAnnotatable ? '0' : '-1'}
          role=${effectiveAnnotatable ? 'group' : nothing}
          aria-label=${effectiveAnnotatable ? this.localize('imageViewerAnnotate') : nothing}
          aria-description=${effectiveAnnotatable ? this.localize('imageViewerAnnotationHint') : nothing}
          style=${styleMap({
            transform: layout
              ? `translate(-50%, -50%) rotate(${this.safeRotation}deg)`
              : `rotate(${this.safeRotation}deg)`,
          })}
          @keydown=${this.onWrapperKeyDown}
          @pointerdown=${this.onWrapperPointerDown}
          @pointermove=${this.onWrapperPointerMove}
          @pointerup=${this.onWrapperPointerUp}
          @pointercancel=${(event: PointerEvent) => this.cancelPointerDraft(event.pointerId)}
          @lostpointercapture=${(event: PointerEvent) => this.cancelPointerDraft(event.pointerId, false)}
        >
          ${safeSrc
            ? keyed(safeSrc, html`<img part="image" data-fit=${this.fit} src=${safeSrc} alt=${this.alt ?? this.name} @load=${this.onImgLoad} @error=${this.onImgError} />`)
            : nothing}
          ${this.renderHighlights()}
          ${this.renderDraft()}
          ${this.renderRevealTarget()}
        </div>
      </div>
    </lr-pan-zoom>`;
  }

  override render(): TemplateResult {
    const label = hostAriaLabel(this) ?? (this.name || this.localize('imageViewerLabel'));
    const operable = this.hasOperableContent;
    return html`<div part="base" role="region" aria-label=${label}>
      <div part="toolbar">
        <span class="fit-control-wrapper">
          <select part="fit-control" aria-label=${this.localize('imageViewerFitLabel')} ?disabled=${!operable} @change=${this.onFitChange}>
            <option value="contain" ?selected=${this.fit === 'contain'}>${this.localize('imageViewerFitContain')}</option>
            <option value="width" ?selected=${this.fit === 'width'}>${this.localize('imageViewerFitWidth')}</option>
            <option value="actual" ?selected=${this.fit === 'actual'}>${this.localize('imageViewerFitActual')}</option>
          </select>
          <span class="fit-control-chevron" aria-hidden="true">${chevronIcon()}</span>
        </span>
        <button part="rotate-button" type="button" ?disabled=${!operable} aria-label=${this.localize('imageViewerRotate')} @click=${() => this.rotate()}>&#8635;</button>
        <button part="annotate-toggle" type="button" ?disabled=${!operable} aria-pressed=${this.annotatable && operable ? 'true' : 'false'} aria-label=${this.localize('imageViewerAnnotate')} @click=${this.toggleAnnotatable}>&#9633;</button>
      </div>
      ${this.renderBody()}
      <lr-live-region></lr-live-region>
      ${this.renderAnchorLiveRegion()}
    </div>`;
  }

  override disconnectedCallback(): void {
    this.cancelPointerDraft();
    this.disconnectGeometryObserver();
    this.releaseErrorAnnouncementSink();
    super.disconnectedCallback();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-image-viewer': LyraImageViewer;
  }
}
