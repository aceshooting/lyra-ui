import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { srOnly } from '../../../internal/a11y.js';
import {
  DocumentAnchorTarget,
  prioritizedHighlightCandidates,
  type LyraAnchorTargetEventMap,
} from '../../../internal/anchor-target.js';
import { isAbortError, isResourceLimitError, LyraUserFacingError, readResponseText, resolveOwnerFetchTarget } from '../../../internal/resource-loader.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { loadSvgSanitizer } from './dompurify-loader.js';
import { styles } from './svg-viewer.styles.js';
import type { LyraAnchor, LyraAnchorKind, LyraHighlight } from '../document-viewer/anchors.js';
import { sanitizeCssLength, sanitizePercentRect } from '../../../internal/safe-css.js';
import { ViewerAnnouncementController } from '../viewer-announcements.js';
import type { HtmlSanitizer } from '../../../internal/optional-peer-capabilities.js';
import { viewerSemanticLabel, viewerSemanticRole } from '../viewer-semantic-owner.js';
import { renderViewerLoading, viewerLoadingStyles } from '../viewer-loading.js';
import { sanitizePassiveMarkup } from '../passive-markup.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound, LYRA_DEFAULT_documentPreviewEmpty, LYRA_DEFAULT_documentPreviewFailedToLoad, LYRA_DEFAULT_documentPreviewResourceTooLarge, LYRA_DEFAULT_documentPreviewTypeImage, LYRA_DEFAULT_documentPreviewUrlNotAllowed, LYRA_DEFAULT_documentViewerMissingSanitizer, LYRA_DEFAULT_highlightOfTotal, LYRA_DEFAULT_highlightWithLabel, LYRA_DEFAULT_loadingDocument, LYRA_DEFAULT_svgViewerLabel } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


function sameRegionAnchor(a: LyraAnchor, b: LyraAnchor): boolean {
  if (a.kind !== 'region' || b.kind !== 'region') return false;
  return (
    a.page === b.page &&
    a.rect.x === b.rect.x &&
    a.rect.y === b.rect.y &&
    a.rect.width === b.rect.width &&
    a.rect.height === b.rect.height
  );
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
): string {
  const markup = sanitizePassiveMarkup(sanitizer, raw, ownerDocument, 'passive-svg');
  const template = ownerDocument.createElement('template');
  template.innerHTML = markup;
  if (!template.content.querySelector('svg')) {
    throw new Error('SVG sanitizer did not return an SVG document.');
  }
  return markup;
}

type SvgFetchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; markup: string }
  | { kind: 'error'; message: string };

type ResolvedRegionHighlight = LyraHighlight & {
  anchor: { kind: 'region'; rect: { x: number; y: number; width: number; height: number } };
};

const MAX_PAINTED_HIGHLIGHTS = 100;

export interface LyraSvgViewerEventMap extends Omit<LyraAnchorTargetEventMap, 'lr-text-select'> {
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
 *   with a minimum pointer/focus area independent of the visual rectangle.
 * @csspart highlight-actions - Non-overlapping actions used for multiple region highlights.
 * @csspart region-highlight-action - One non-overlapping highlight action.
 * @cssprop [--lr-svg-viewer-max-height=none] - Maximum block size of the scrollable body before it scrolls internally. Also settable via the `max-height` property.
 * @cssprop [--lr-svg-viewer-active-border=var(--lr-color-warning, var(--lr-color-brand))] - Border
 *   color of the `[part="region-highlight"]` matching `activeHighlightId`. Distinct from the
 *   resting highlight border, so the active region can be recolored without touching the rest.
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
    documentPreviewEmpty: LYRA_DEFAULT_documentPreviewEmpty,
    documentPreviewFailedToLoad: LYRA_DEFAULT_documentPreviewFailedToLoad,
    documentPreviewResourceTooLarge: LYRA_DEFAULT_documentPreviewResourceTooLarge,
    documentPreviewTypeImage: LYRA_DEFAULT_documentPreviewTypeImage,
    documentPreviewUrlNotAllowed: LYRA_DEFAULT_documentPreviewUrlNotAllowed,
    documentViewerMissingSanitizer: LYRA_DEFAULT_documentViewerMissingSanitizer,
    highlightOfTotal: LYRA_DEFAULT_highlightOfTotal,
    highlightWithLabel: LYRA_DEFAULT_highlightWithLabel,
    loadingDocument: LYRA_DEFAULT_loadingDocument,
    svgViewerLabel: LYRA_DEFAULT_svgViewerLabel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, viewerLoadingStyles, srOnly];

  /** URL to fetch and render as sanitized inline SVG. */
  @property() src = '';

  /** Accessible name for the rendered SVG surface. The surface is an image while passive and a
   * region when zoom controls or highlight actions make it interactive. */
  @property() name = '';

  /** CSS length that caps the scrollable body. Invalid values are ignored. */
  @property({ attribute: 'max-height' }) maxHeight = '';

  /** Wraps the rendered content in an internal `<lr-pan-zoom>`. `false` (the default)
   *  preserves today's exact DOM -- an inline thumbnail (e.g. in a chat stream) must not
   *  unexpectedly grow a focusable zoom-chrome viewport; an inspection surface opts in. */
  @property({ type: Boolean, reflect: true }) zoomable = false;

  /** Anchor kinds this viewer resolves via `scrollToAnchor()`. `highlights`/`activeHighlightId`/
   *  `anchor` are inherited from `DocumentAnchorTarget` -- display-only, no creation UI here. */
  override readonly anchorKinds: readonly LyraAnchorKind[] = ['region'];

  @state() private fetchState: SvgFetchState = { kind: 'idle' };
  private generation = 0;
  private readonly announcements = new ViewerAnnouncementController(this);

  override connectedCallback(): void {
    super.connectedCallback();
    this.announcements.connect();
    if (this.hasUpdated && this.src) this.scheduleAfterUpdate(() => { void this.load(); });
  }

  override disconnectedCallback(): void {
    this.generation++;
    this.beginAbortableLoad();
    this.fetchState = { kind: 'idle' };
    this.announcements.disconnect();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.announcements.adopted();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.announcements.transition(
      'load',
      this.fetchState.kind,
      this.fetchState.kind === 'error' ? this.fetchState.message : this.localize('loadingDocument'),
    );
    if (changed.has('src')) this.scheduleAfterUpdate(() => { void this.load(); });
  }

  private async load(): Promise<void> {
    const generation = ++this.generation;
    const signal = this.beginAbortableLoad();
    if (!this.src) {
      this.fetchState = { kind: 'idle' };
      return;
    }
    const fetchTarget = resolveOwnerFetchTarget(this, this.src);
    if (!fetchTarget) {
      const error = new LyraUserFacingError(this.localize('documentPreviewUrlNotAllowed'));
      this.fetchState = { kind: 'error', message: error.message };
      this.emit('lr-render-error', { error });
      return;
    }
    this.fetchState = { kind: 'loading' };
    try {
      const response = await fetchTarget.view.fetch(fetchTarget.url, signal ? { signal } : undefined);
      if (!this.isConnected || generation !== this.generation) return;
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const sanitizer = await loadSvgSanitizer();
      if (!this.isConnected || generation !== this.generation) return;
      if (!sanitizer) throw new LyraUserFacingError(this.localize('documentViewerMissingSanitizer'));
      const raw = await readResponseText(response);
      if (!this.isConnected || generation !== this.generation) return;
      const markup = sanitizeInlineSvg(sanitizer, raw, this.ownerDocument);
      if (this.isConnected && generation === this.generation) {
        this.fetchState = { kind: 'loaded', markup };
      }
    } catch (error) {
      if (isAbortError(error) || !this.isConnected || generation !== this.generation) return;
      const message = error instanceof LyraUserFacingError
        ? error.message
        : this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'documentPreviewFailedToLoad');
      this.fetchState = { kind: 'error', message };
      this.emit('lr-render-error', { error });
    }
  }

  private renderBody(regionHighlights: ResolvedRegionHighlight[]): TemplateResult {
    switch (this.fetchState.kind) {
      case 'loaded':
        return this.renderZoomableWrapper(
          html`<div part="svg">${unsafeSVG(this.fetchState.markup)}</div>`,
          regionHighlights,
        );
      case 'loading':
        return renderViewerLoading(this.localize('loadingDocument'));
      case 'error':
        return html`<div part="error">${this.fetchState.message}</div>`;
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
    const inner = html`<div class="zoom-content">
      ${content}${this.renderHighlightLayer(regionHighlights, regionHighlights.length === 1)}
    </div>`;
    const frame = this.zoomable ? html`<lr-pan-zoom
      exportparts="viewport:frame-viewport, content:frame-content, controls:frame-controls, zoom-in:frame-zoom-in, zoom-out:frame-zoom-out, reset:frame-reset"
      @lr-zoom-change=${this.stopPanZoomEvent}
    >${inner}</lr-pan-zoom>` : inner;
    return html`${frame}${this.renderHighlightActions(regionHighlights)}`;
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
      if (resolved.length >= MAX_PAINTED_HIGHLIGHTS) break;
    }
    return resolved;
  }

  private highlightActionLabel(
    highlight: LyraHighlight,
    index: number,
    total: number,
  ): string {
    if (highlight.label) {
      return this.localize('highlightWithLabel', undefined, { label: highlight.label });
    }
    const numberFormat = getNumberFormat(this.effectiveLocale);
    return this.localize('highlightOfTotal', undefined, {
      index: numberFormat.format(index + 1),
      total: numberFormat.format(total),
    });
  }

  private renderHighlightLayer(
    regionHighlights: ResolvedRegionHighlight[],
    interactive: boolean,
  ): TemplateResult | typeof nothing {
    if (!regionHighlights.length) return nothing;
    // Region rects are physical percent-of-render coordinates and the rendered SVG never
    // mirrors, so position with physical left/top -- logical inset-inline-start would flip the
    // overlay under RTL while the render underneath stays put.
    return html`<div part="highlight-layer">
      ${regionHighlights.map(
        (h, index) => html`
          ${interactive ? html`<button
            part="region-highlight-target"
            data-highlight-id=${h.id}
            style=${styleMap({
              left: `calc(${h.anchor.rect.x}% + ${h.anchor.rect.width / 2}%)`,
              top: `calc(${h.anchor.rect.y}% + ${h.anchor.rect.height / 2}%)`,
              width: `max(${h.anchor.rect.width}%, var(--lr-icon-button-size))`,
              height: `max(${h.anchor.rect.height}%, var(--lr-icon-button-size))`,
            })}
            type="button"
            role="button"
            aria-label=${this.highlightActionLabel(h, index, regionHighlights.length)}
            @click=${() => this.emit('lr-highlight-activate', { highlightId: h.id })}
          ></button>` : nothing}
          <div
            part="region-highlight"
            data-id=${h.id}
            data-tone=${h.tone ?? 'accent'}
            ?data-active=${h.id === this.activeHighlightId}
            aria-hidden="true"
            style=${styleMap({
              left: `${h.anchor.rect.x}%`,
              top: `${h.anchor.rect.y}%`,
              width: `${h.anchor.rect.width}%`,
              height: `${h.anchor.rect.height}%`,
            })}
          ></div>
        `,
      )}
    </div>`;
  }

  private renderHighlightActions(
    regionHighlights: ResolvedRegionHighlight[],
  ): TemplateResult | typeof nothing {
    if (regionHighlights.length < 2) return nothing;
    return html`<div part="highlight-actions">
      ${regionHighlights.map((highlight, index) => {
        const label = this.highlightActionLabel(highlight, index, regionHighlights.length);
        return html`
        <button
          part="region-highlight-action"
          type="button"
          data-highlight-id=${highlight.id}
          aria-label=${label}
          @click=${() => this.emit('lr-highlight-activate', { highlightId: highlight.id })}
        >
          ${highlight.label || label}
        </button>
      `;
      })}
    </div>`;
  }

  /** Per-viewer hook for `DocumentAnchorTarget`: resolves a `region` anchor back to its owning
   *  `highlights` entry (matched by reference first, so `scrollToAnchor(highlight.anchor)`
   *  resolves directly, then by structural equality of `rect`/`page` so an equivalent
   *  freshly-built anchor also resolves) and scrolls its rendered box into view. Declines (no
   *  retry-worthy transient state of its own here) when nothing is loaded yet or no region
   *  matches -- the mixin's own retry loop covers the case where `anchor`/`scrollToAnchor()` is
   *  called before `src` has finished loading. */
  protected async applyAnchor(anchor: LyraAnchor): Promise<boolean> {
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
    const behavior = prefersReducedMotion(this.ownerDocument.defaultView) ? 'auto' : 'smooth';
    region.scrollIntoView({ behavior, block: 'center', inline: 'center' });
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
    return html`<div part="base" role=${viewerSemanticRole(this, surfaceRole) ?? nothing} aria-label=${viewerSemanticLabel(this, this.name || this.localize('svgViewerLabel')) ?? nothing} aria-busy=${this.fetchState.kind === 'loading' ? 'true' : 'false'} style=${maxHeight ? styleMap({ '--lr-svg-viewer-max-height': maxHeight }) : nothing}>
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
