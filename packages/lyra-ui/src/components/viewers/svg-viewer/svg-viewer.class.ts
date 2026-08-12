import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { DocumentAnchorTarget, type LyraAnchorTargetEventMap } from '../../../internal/anchor-target.js';
import { isAbortError, isResourceLimitError, LyraUserFacingError, readResponseText, resolveOwnerFetchTarget } from '../../../internal/resource-loader.js';
import { srOnly } from '../../../internal/a11y.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { loadSvgSanitizer } from './dompurify-loader.js';
import { styles } from './svg-viewer.styles.js';
import type { LyraAnchor, LyraAnchorKind, LyraHighlight } from '../document-viewer/anchors.js';
import { sanitizeCssLength, sanitizePercentRect } from '../../../internal/safe-css.js';
import { ViewerAnnouncementController } from '../viewer-announcements.js';
import type { HtmlSanitizer } from '../../../internal/optional-peer-capabilities.js';
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

const SVG_RESOURCE_ATTRIBUTES = new Set(['href', 'xlink:href', 'src']);
const SVG_PAINT_SERVER_ATTRIBUTES = new Set([
  'clip-path',
  'cursor',
  'fill',
  'filter',
  'marker',
  'marker-end',
  'marker-mid',
  'marker-start',
  'mask',
  'stroke',
]);
const LOCAL_SVG_PAINT_REFERENCE = /^url\(\s*(['"]?)#[^()'"\s]+\1\s*\)$/i;
const LOCAL_SVG_RESOURCE_REFERENCE = /^#[^\s]+$/;
const INLINE_RASTER_DATA_REFERENCE = /^data:image\/(?:gif|jpeg|png|webp);base64,[a-z\d+/=\s]+$/i;

function isSafeSvgResourceReference(value: string): boolean {
  const normalized = value.trim();
  return LOCAL_SVG_RESOURCE_REFERENCE.test(normalized)
    || INLINE_RASTER_DATA_REFERENCE.test(normalized);
}

/**
 * Applies Lyra's inline-SVG profile after DOMPurify's structural allowlist. DOMPurify deliberately
 * permits author styles and ordinary HTTP hrefs by default; both are unsafe for a document that is
 * inserted into the caller's shadow root because they can escape its paint box or start secondary
 * requests. Local fragment paint servers and embedded raster data remain usable.
 */
function sanitizeInlineSvg(
  sanitizer: HtmlSanitizer,
  raw: string,
  ownerDocument: Document,
): string {
  const sanitized = sanitizer.sanitize(raw, {
    USE_PROFILES: { svg: true, svgFilters: true },
    RETURN_DOM_FRAGMENT: true,
    FORBID_TAGS: ['style', 'animate', 'animatemotion', 'animatetransform', 'set', 'discard'],
    FORBID_ATTR: ['style'],
  });
  if (
    typeof sanitized !== 'object'
    || sanitized === null
    || !('nodeType' in sanitized)
    || sanitized.nodeType !== 11
  ) {
    throw new Error('SVG sanitizer did not return a document fragment.');
  }
  const fragment = sanitized as DocumentFragment;
  fragment.querySelectorAll('style, animate, animateMotion, animateTransform, set, discard')
    .forEach((element) => element.remove());
  for (const element of fragment.querySelectorAll('*')) {
    element.removeAttribute('style');
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (
        SVG_RESOURCE_ATTRIBUTES.has(name)
        && !isSafeSvgResourceReference(attribute.value)
      ) {
        element.removeAttributeNode(attribute);
        continue;
      }
      if (
        SVG_PAINT_SERVER_ATTRIBUTES.has(name)
        && (/url\s*\(/i.test(attribute.value) || attribute.value.includes('\\'))
        && !LOCAL_SVG_PAINT_REFERENCE.test(attribute.value.trim())
      ) {
        element.removeAttributeNode(attribute);
      }
    }
  }
  const template = ownerDocument.createElement('template');
  template.content.append(fragment);
  return template.innerHTML;
}

type SvgFetchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; markup: string }
  | { kind: 'error'; message: string };

export interface LyraSvgViewerEventMap extends LyraAnchorTargetEventMap {
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
 * pages nor extractable text to quote.
 *
 * @customElement lr-svg-viewer
 * @event lr-render-error - Fired when fetching or sanitizing the document fails.
 * @event lr-highlight-activate - A region highlight was activated. `detail: { id }`.
 * @event lr-anchor-result - Fired after an `anchor` property assignment or a `scrollToAnchor()`
 *   call is applied. `detail: { found }`.
 * @csspart base - The root container.
 * @csspart body - The wrapper around the fetched-state content.
 * @csspart svg - The sanitized SVG document, once loaded.
 * @csspart spinner - Ordinary loading content; transitions announce through the shared
 *   document-level polite region.
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

  static override styles = [LyraElement.styles, styles, srOnly];

  /** URL to fetch and render as sanitized inline SVG. */
  @property() src = '';

  /** Accessible name for the rendered SVG. */
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

  adoptedCallback(): void {
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

  private renderBody(): TemplateResult {
    switch (this.fetchState.kind) {
      case 'loaded':
        return this.renderZoomableWrapper(
          html`<div part="svg" role="img" aria-label=${this.getAttribute('aria-label') || this.name || this.localize('svgViewerLabel')}>${unsafeSVG(this.fetchState.markup)}</div>`,
        );
      case 'loading':
        return html`<div part="spinner"><span class="sr-only">${this.localize('loadingDocument')}</span></div>`;
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
  private renderZoomableWrapper(content: TemplateResult): TemplateResult {
    const regionHighlights = this.regionHighlights();
    const inner = html`<div class="zoom-content">
      ${content}${this.renderHighlightLayer(regionHighlights, regionHighlights.length === 1)}
    </div>`;
    const frame = this.zoomable ? html`<lr-pan-zoom
      exportparts="viewport:frame-viewport, content:frame-content, controls:frame-controls, zoom-in:frame-zoom-in, zoom-out:frame-zoom-out, reset:frame-reset"
      @lr-zoom-change=${this.stopPanZoomEvent}
    >${inner}</lr-pan-zoom>` : inner;
    return html`${frame}${this.renderHighlightActions(regionHighlights)}`;
  }

  private regionHighlights(): Array<
    LyraHighlight & {
      anchor: { kind: 'region'; rect: { x: number; y: number; width: number; height: number } };
    }
  > {
    return this.highlights.flatMap((highlight) => {
      if (highlight.anchor.kind !== 'region') return [];
      const rect = sanitizePercentRect(highlight.anchor.rect);
      return rect
        ? [
            {
              ...highlight,
              anchor: { ...highlight.anchor, rect },
            } as LyraHighlight & {
              anchor: {
                kind: 'region';
                rect: { x: number; y: number; width: number; height: number };
              };
            },
          ]
        : [];
    });
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
    regionHighlights: ReturnType<LyraSvgViewer['regionHighlights']>,
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
            @click=${() => this.emit('lr-highlight-activate', { id: h.id })}
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
    regionHighlights: ReturnType<LyraSvgViewer['regionHighlights']>,
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
          @click=${() => this.emit('lr-highlight-activate', { id: highlight.id })}
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
    return html`<div part="base" style=${maxHeight ? styleMap({ '--lr-svg-viewer-max-height': maxHeight }) : nothing}>
      <div part="body">${this.renderBody()}</div>
      ${this.renderAnchorLiveRegion()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-svg-viewer': LyraSvgViewer;
  }
}
