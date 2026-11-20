import { normalizeLabel } from '../../../internal/accessible-name.js';
import { revealInOwnScroller } from '../../../internal/reveal-row.js';
import { makeScrollRegionFocusable } from '../../../internal/scroll-region.js';
import { ViewerSourceController, ViewerSourceUrlNotAllowedError, type ViewerSourceToken } from '../../../internal/viewer-source-controller.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { ref } from 'lit/directives/ref.js';
import { RegionHitTargetsController } from '../../../internal/region-hit-targets.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { srOnly } from '../../../internal/a11y.js';
import {
  DocumentAnchorTargetBase as DocumentAnchorTarget,
  prioritizedHighlightCandidates,
  type LyraAnchorTargetEventMap,
} from '../../../internal/anchor-target-base.js';
import { LyraUserFacingError } from '../../../internal/resource-loader.js';
import { viewerFailureMessage } from '../../../internal/viewer-failure-message.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { loadDompurify } from '../../../internal/dompurify-loader.js';
import { styles } from './svg-viewer.styles.js';
import type { LyraAnchor, LyraAnchorKind, LyraHighlight } from '../../../internal/document-anchors.js';
import { sanitizeCssLength, sanitizePercentRect } from '../../../internal/safe-css.js';
import { ViewerAnnouncementController } from '../viewer-announcements.js';
import type { HtmlSanitizer } from '../../../internal/optional-peer-capabilities.js';
import { viewerSemanticLabel, viewerSemanticRole } from '../viewer-semantic-owner.js';
import { renderViewerLoading, viewerLoadingStyles } from '../viewer-loading.js';
import { viewerFrameStyles } from '../viewer-frame.js';
import {
  regionHighlightLabel,
  renderRegionHighlightActions,
  renderRegionHighlightLayer,
  sameRegionRect,
} from '../region-highlight-layer.js';
import { sanitizePassiveMarkupFragment } from '../../../internal/passive-markup.js';
import { DeferredTeardown } from '../../../internal/deferred-teardown.js';
import { VIEWER_PAINTED_HIGHLIGHT_LIMIT } from '../viewer-search-limits.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound, LYRA_DEFAULT_collapse, LYRA_DEFAULT_copy, LYRA_DEFAULT_date, LYRA_DEFAULT_details, LYRA_DEFAULT_documentPreviewEmpty, LYRA_DEFAULT_documentPreviewTypeImage, LYRA_DEFAULT_download, LYRA_DEFAULT_highlightOfTotal, LYRA_DEFAULT_highlightWithLabel, LYRA_DEFAULT_loading, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_popover, LYRA_DEFAULT_scrollerLabel, LYRA_DEFAULT_search, LYRA_DEFAULT_select } from '../../../internal/default-strings/shared.generated.js';
import { LYRA_DEFAULT_documentPreviewFailedToLoad, LYRA_DEFAULT_documentPreviewResourceTooLarge, LYRA_DEFAULT_documentPreviewUrlNotAllowed, LYRA_DEFAULT_documentViewerMissingSanitizer, LYRA_DEFAULT_loadingDocument, LYRA_DEFAULT_svgViewerLabel } from '../../../internal/default-strings/viewers.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


function sameRegionAnchor(a: LyraAnchor, b: LyraAnchor): boolean {
  return a.kind === 'region' && b.kind === 'region' && sameRegionRect(a, b);
}

/**
 * Applies the viewer family's one passive-SVG profile after DOMPurify's structural allowlist.
 * Local fragment paint servers and embedded raster data remain usable; every network, style,
 * animation and interaction sink is removed by the shared post-sanitization engine.
 */
function sanitizeInlineSvg(
  sanitizer: HtmlSanitizer,
  raw: string,
  ownerDocument: Document,
): readonly Node[] {
  const fragment = sanitizePassiveMarkupFragment(sanitizer, raw, ownerDocument, 'passive-svg');
  if (!fragment.querySelector('svg')) {
    throw new Error('SVG sanitizer did not return an SVG document.');
  }
  return Array.from(fragment.childNodes);
}

type SvgFetchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; markup: readonly Node[] }
  | { kind: 'error'; message: () => string };

type ResolvedRegionHighlight = LyraHighlight & {
  anchor: { kind: 'region'; rect: { x: number; y: number; width: number; height: number } };
};


export interface LyraSvgViewerEventMap extends Omit<LyraAnchorTargetEventMap, 'lr-text-select'> {
  'lr-load': CustomEvent<Record<string, never>>;
  'lr-render-error': CustomEvent<{ error: unknown }>;
}

class LyraSvgViewerBase extends LyraElement<LyraSvgViewerEventMap> {}

/**
 * Fetches and safely renders an inline SVG document. Author styles, SVG animation elements, and
 * external resource/paint-server references are removed before insertion; local fragment paint
 * servers and embedded raster data remain available without secondary network requests.
 *
 * Adopts `DocumentAnchorTarget`: a `region` anchor addresses one `highlights` entry by reference
 * or structural equality of its `rect` (and optional `page`) -- `scrollToAnchor()`/a declarative
 * `anchor` assignment scrolls the matching `[part="region-highlight"]` into view and fires
 * `lr-anchor-result`. No other anchor kind resolves here -- a sanitized SVG document has neither
 * pages nor extractable text to quote. At most 100 valid region highlights are painted from a
 * 1,000-entry candidate window; `activeHighlightId` is retained from anywhere in the bounded host
 * snapshot and placed first inside both paint ceilings.
 *
 * @customElement lr-svg-viewer
 * @event lr-load - Fired after rendering a successfully parsed document. Bubbles and is composed with empty detail.
 * @event lr-render-error - Fired when fetching or sanitizing the document fails.
 * @event lr-highlight-activate - A region highlight was activated. `detail: { highlightId }`.
 * @event lr-anchor-result - Fired after an `anchor` property assignment or a `scrollToAnchor()`
 *   call is applied. `detail: { found }`.
 * @csspart base - The root container. It owns `role="img"` only for passive loaded SVG content;
 *   idle, loading, error, zoomable, and interactive-highlight states use `role="region"` so their
 *   descendant state text and controls remain exposed to assistive technology.
 * @csspart body - The wrapper around the fetched-state content.
 * @csspart svg - The sanitized SVG document, once loaded.
 * @csspart spinner - Visible ordinary loading content with a motion-safe progress indicator;
 *   transitions announce through the shared document-level polite region.
 * @csspart error - Visible ordinary error text; transitions announce through the shared
 *   document-level assertive region.
 * @csspart frame-viewport - Forwarded from the internal `<lr-pan-zoom>` when `zoomable`.
 * @csspart frame-content - Forwarded from the internal `<lr-pan-zoom>` when `zoomable`.
 * @csspart frame-controls - Forwarded from the internal `<lr-pan-zoom>` when `zoomable`.
 * @csspart frame-zoom-in - Forwarded from the internal `<lr-pan-zoom>` when `zoomable`.
 * @csspart frame-zoom-out - Forwarded from the internal `<lr-pan-zoom>` when `zoomable`.
 * @csspart frame-reset - Forwarded from the internal `<lr-pan-zoom>` when `zoomable`.
 * @csspart highlight-layer - The wrapper around every rendered region highlight.
 * @csspart region-highlight - One region highlight (`data-tone`, `data-active`).
 * @csspart region-highlight-target - Transparent activation geometry around a region highlight,
 *   with a minimum pointer/focus area independent of the visual rectangle; `aria-current` is
 *   `"true"` on the `activeHighlightId` match, as on `region-highlight-action`.
 * @csspart highlight-actions - Non-overlapping actions used instead of on-image targets when the
 *   minimum hit areas of two or more region highlights would overlap.
 * @csspart region-highlight-action - One non-overlapping highlight action.
 * @cssprop --lr-svg-viewer-action-background - Resting background of viewer actions.
 * @cssprop --lr-svg-viewer-action-hover-background - Hover background of viewer actions.
 * @cssprop --lr-svg-viewer-action-active-background - Pressed background of viewer actions.
 * @cssprop [--lr-svg-viewer-max-height=none] - Maximum block size of the scrollable body before it scrolls internally. Also settable via the `max-height` property.
 * @cssprop [--lr-svg-viewer-active-border=var(--lr-color-warning, var(--lr-color-brand))] - Border
 *   and outer-ring color of the `[part="region-highlight"]` matching `activeHighlightId`. The ring
 *   keeps the active region distinct from a warning-tone highlight.
 * @cssprop [--lr-svg-viewer-highlight-accent-color=var(--lr-color-brand)] - Accent highlight border and hover tint.
 * @cssprop [--lr-svg-viewer-highlight-success-color=var(--lr-color-success)] - Success highlight border and hover tint.
 * @cssprop [--lr-svg-viewer-highlight-warning-color=var(--lr-color-warning)] - Warning highlight border and hover tint.
 * @cssprop [--lr-svg-viewer-highlight-danger-color=var(--lr-color-danger)] - Danger highlight border and hover tint.
 * @cssprop [--lr-svg-viewer-highlight-neutral-color=var(--lr-color-neutral)] - Neutral highlight border and hover tint.
 * @status stable
 * @since 4.0.0
 */
export class LyraSvgViewer extends DocumentAnchorTarget(LyraSvgViewerBase) {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    anchorJumped: LYRA_DEFAULT_anchorJumped,
    anchorJumpedToPage: LYRA_DEFAULT_anchorJumpedToPage,
    anchorNotFound: LYRA_DEFAULT_anchorNotFound,
    collapse: LYRA_DEFAULT_collapse,
    copy: LYRA_DEFAULT_copy,
    date: LYRA_DEFAULT_date,
    details: LYRA_DEFAULT_details,
    documentPreviewEmpty: LYRA_DEFAULT_documentPreviewEmpty,
    documentPreviewFailedToLoad: LYRA_DEFAULT_documentPreviewFailedToLoad,
    documentPreviewResourceTooLarge: LYRA_DEFAULT_documentPreviewResourceTooLarge,
    documentPreviewTypeImage: LYRA_DEFAULT_documentPreviewTypeImage,
    documentPreviewUrlNotAllowed: LYRA_DEFAULT_documentPreviewUrlNotAllowed,
    documentViewerMissingSanitizer: LYRA_DEFAULT_documentViewerMissingSanitizer,
    download: LYRA_DEFAULT_download,
    highlightOfTotal: LYRA_DEFAULT_highlightOfTotal,
    highlightWithLabel: LYRA_DEFAULT_highlightWithLabel,
    loading: LYRA_DEFAULT_loading,
    loadingDocument: LYRA_DEFAULT_loadingDocument,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    popover: LYRA_DEFAULT_popover,
    scrollerLabel: LYRA_DEFAULT_scrollerLabel,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
    svgViewerLabel: LYRA_DEFAULT_svgViewerLabel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, viewerFrameStyles, viewerLoadingStyles, srOnly];

  /** URL to fetch and render as sanitized inline SVG. */
  @property() src = '';

  /** Accessible name for the rendered SVG surface. The surface is an image while passive and a
   * region when zoom controls or highlight actions make it interactive. */
  @property() name = '';

  /** CSS length that caps the scrollable body. Fitting content stays centered; overflowing
   * SVG content starts inside the reachable scroll range. Invalid values are ignored. */
  @property({ attribute: 'max-height' }) maxHeight = '';

  /** Wraps the rendered content in an internal `<lr-pan-zoom>`. `false` (the default)
   *  renders no `<lr-pan-zoom>` -- an inline thumbnail (e.g. in a chat stream) must not
   *  unexpectedly grow a focusable zoom-chrome viewport; an inspection surface opts in. */
  @property({ type: Boolean, reflect: true }) zoomable = false;

  /** Anchor kinds this viewer resolves via `scrollToAnchor()`. `highlights`/`activeHighlightId`/
   *  `anchor` are inherited from `DocumentAnchorTarget` -- display-only, no creation UI here. */
  override readonly anchorKinds: readonly LyraAnchorKind[] = ['region'];

  @state() private fetchState: SvgFetchState = { kind: 'idle' };
  private readonly transport = new ViewerSourceController(this, {
    load: (response, token) => this.readDocument(response, token),
    onError: error => {
      const failure = error instanceof ViewerSourceUrlNotAllowedError
        ? new LyraUserFacingError(this.localize('documentPreviewUrlNotAllowed'), localize => localize('documentPreviewUrlNotAllowed'))
        : error;
      this.fetchState = { kind: 'error', message: viewerFailureMessage(failure, this.localize.bind(this)) };
      this.emit('lr-render-error', { error: failure });
    },
  });
  private readonly announcements = new ViewerAnnouncementController(this);
  private readonly regionTargets = new RegionHitTargetsController(this, () =>
    this.regionHighlights().map(({ anchor }) => anchor.rect));

  private releaseScrollRegion?: () => void;

  private syncScrollRegion(): void {
    this.releaseScrollRegion?.();
    const body = this.renderRoot.querySelector<HTMLElement>('[part="body"]');
    this.releaseScrollRegion = body && this.isConnected
      ? makeScrollRegionFocusable(body, this.localize('scrollerLabel'))
      : undefined;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this.syncScrollRegion();
    this.announcements.connect();
    if (this.detached.cancel() && this.fetchState.kind !== 'loading') return;
    if (this.hasUpdated && this.src) this.scheduleAfterUpdate(() => { void this.load(); });
  }

  /** A same-task DOM move keeps the rendered image; a genuine disconnect aborts and resets. */
  private readonly detached = new DeferredTeardown(() => {
    this.fetchState = { kind: 'idle' };
  });

  override disconnectedCallback(): void {
    this.announcements.disconnect();
    this.releaseScrollRegion?.();
    this.releaseScrollRegion = undefined;
    super.disconnectedCallback();
    this.detached.schedule();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.detached.flush();
    this.announcements.adopted();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.syncScrollRegion();
    this.announcements.transition(
      'load',
      this.fetchState.kind,
      this.fetchState.kind === 'error' ? this.fetchState.message() : this.localize('loadingDocument'),
    );
    if (changed.has('src')) this.scheduleAfterUpdate(() => { void this.load(); });
    if (changed.has('highlights') || changed.has('activeHighlightId')) this.regionTargets.sync();
    if (this.isConnected && changed.has('fetchState') && this.fetchState.kind === 'loaded') this.emit('lr-load', {});
  }

  private load(): Promise<void> {
    this.fetchState = this.src ? { kind: 'loading' } : { kind: 'idle' };
    return this.transport.begin(this.src);
  }

  private async readDocument(response: Response, token: ViewerSourceToken): Promise<void> {
    const sanitizer = await loadDompurify();
    if (this.transport.isStale(token)) return;
    if (!sanitizer) {
      throw new LyraUserFacingError(
        this.localize('documentViewerMissingSanitizer'),
        (localize) => localize('documentViewerMissingSanitizer'),
      );
    }
    const raw = await this.transport.readText(response);
    if (this.transport.isStale(token)) return;
    const markup = sanitizeInlineSvg(sanitizer, raw, this.ownerDocument);
    if (!this.transport.isStale(token)) {
      this.fetchState = { kind: 'loaded', markup };
    }
  }

  private renderBody(regionHighlights: ResolvedRegionHighlight[]): TemplateResult {
    switch (this.fetchState.kind) {
      case 'loaded':
        return this.renderZoomableWrapper(
          html`<div part="svg">${this.fetchState.markup}</div>`,
          regionHighlights,
        );
      case 'loading':
        return renderViewerLoading(this.localize('loadingDocument'));
      case 'error':
        return html`<div part="error">${this.fetchState.message()}</div>`;
      case 'idle':
      default:
        return html`<p class="empty-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeImage') })}</p>`;
    }
  }

  private stopPanZoomEvent(event: Event): void {
    event.stopPropagation();
  }

  /** Wraps `content` in the internal `<lr-pan-zoom>` when `zoomable`; otherwise renders it
   *  (plus the highlight layer, which needs the same relatively-positioned sibling context either
   *  way) unwrapped, preserving pre-`zoomable` DOM exactly. */
  private renderZoomableWrapper(
    content: TemplateResult,
    regionHighlights: ResolvedRegionHighlight[],
  ): TemplateResult {
    const showActions = this.regionTargets.showActions(regionHighlights.length);
    const inner = html`<div class="zoom-content" ${ref(this.regionTargets.bind)}>
      ${content}${this.renderHighlightLayer(regionHighlights, !showActions)}
    </div>`;
    const frame = this.zoomable ? html`<lr-pan-zoom
      exportparts="viewport:frame-viewport, content:frame-content, controls:frame-controls, zoom-in:frame-zoom-in, zoom-out:frame-zoom-out, reset:frame-reset"
      @lr-zoom-change=${this.stopPanZoomEvent}
    >${inner}</lr-pan-zoom>` : inner;
    return html`${frame}${this.renderHighlightActions(regionHighlights, showActions)}`;
  }

  private regionHighlights(): ResolvedRegionHighlight[] {
    const candidates = prioritizedHighlightCandidates(this.highlights, this.activeHighlightId);
    const seen = new Set<string>();
    const resolved: ResolvedRegionHighlight[] = [];
    for (const highlight of candidates) {
      if (seen.has(highlight.id)) continue;
      seen.add(highlight.id);
      if (highlight.anchor.kind !== 'region') continue;
      const rect = sanitizePercentRect(highlight.anchor.rect);
      if (!rect) continue;
      resolved.push({ ...highlight, anchor: { ...highlight.anchor, rect } });
      if (resolved.length >= VIEWER_PAINTED_HIGHLIGHT_LIMIT) break;
    }
    return resolved;
  }

  private highlightActionLabel(
    highlight: LyraHighlight,
    index: number,
    total: number,
  ): string {
    return regionHighlightLabel(highlight, index, total, this.effectiveLocale,
      (key, values) => this.localize(key, undefined, values));
  }

  private renderHighlightLayer(
    regionHighlights: ResolvedRegionHighlight[],
    interactive: boolean,
  ): TemplateResult | typeof nothing {
    return renderRegionHighlightLayer(regionHighlights, this.activeHighlightId, interactive,
      (highlight, index, total) => this.highlightActionLabel(highlight, index, total),
      (highlightId) => this.emit('lr-highlight-activate', { highlightId }));
  }

  private renderHighlightActions(
    regionHighlights: ResolvedRegionHighlight[],
    showActions: boolean,
  ): TemplateResult | typeof nothing {
    return renderRegionHighlightActions(regionHighlights, this.activeHighlightId,
      (highlight, index, total) => this.highlightActionLabel(highlight, index, total),
      this.renderRoot, this.effectiveDirection === 'rtl',
      (highlightId) => this.emit('lr-highlight-activate', { highlightId }), showActions);
  }

  /** Per-viewer hook for `DocumentAnchorTarget`: resolves a `region` anchor back to its owning
   *  `highlights` entry (matched by reference first, so `scrollToAnchor(highlight.anchor)`
   *  resolves directly, then by structural equality of `rect`/`page` so an equivalent
   *  freshly-built anchor also resolves) and scrolls its rendered box into view. Declines (no
   *  retry-worthy transient state of its own here) when nothing is loaded yet or no region
   *  matches -- the mixin's own retry loop covers the case where `anchor`/`scrollToAnchor()` is
   *  called before `src` has finished loading. */
  protected override async applyAnchor(anchor: LyraAnchor): Promise<boolean> {
    if (anchor.kind !== 'region' || this.fetchState.kind !== 'loaded') return false;
    const highlight = this.highlights.find((h) => h.anchor === anchor || sameRegionAnchor(h.anchor, anchor));
    if (!highlight) return false;
    await this.updateComplete;
    // Use a constant selector plus an exact attribute comparison. Besides accepting every valid
    // consumer id (including selector punctuation), this keeps anchor resolution independent of
    // an ambient or missing `CSS.escape` when the element is adopted into another realm.
    const region = [...this.renderRoot.querySelectorAll('[part~="region-highlight"][data-id]')]
      .find((candidate) => candidate.getAttribute('data-id') === highlight.id);
    if (!region) return false;
    const behavior = prefersReducedMotion(this) ? 'auto' : 'smooth';
    revealInOwnScroller(region, 'nearest', behavior);
    return true;
  }

  override render(): TemplateResult {
    const maxHeight = sanitizeCssLength(this.maxHeight);
    const regionHighlights = this.regionHighlights();
    const surfaceRole = this.fetchState.kind === 'loaded'
      && !this.zoomable
      && regionHighlights.length === 0
      ? 'img'
      : 'region';
    return html`<div part="base" role=${viewerSemanticRole(this, surfaceRole) ?? nothing} aria-label=${viewerSemanticLabel(this, normalizeLabel(this.name) ?? this.localize('svgViewerLabel')) ?? nothing} aria-busy=${this.fetchState.kind === 'loading' ? 'true' : 'false'} style=${maxHeight ? styleMap({ '--lr-svg-viewer-max-height': maxHeight }) : nothing}>
      <div part="body">${this.renderBody(regionHighlights)}</div>
      ${this.renderAnchorLiveRegion()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-svg-viewer': LyraSvgViewer;
  }
}
