import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { safeFetchUrl } from '../../internal/safe-url.js';
import { isAbortError, isResourceLimitError, LyraUserFacingError, readResponseText } from '../../internal/resource-loader.js';
import { srOnly } from '../../internal/a11y.js';
import { prefersReducedMotion } from '../../internal/motion.js';
import { loadSvgSanitizer } from './dompurify-loader.js';
import { styles } from './svg-viewer.styles.js';
import '../zoomable-frame/zoomable-frame.js';
import type { LyraAnchor, LyraHighlight } from '../document-viewer/anchors.js';

type SvgFetchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; markup: string }
  | { kind: 'error'; message: string };

export interface LyraSvgViewerEventMap {
  'lyra-render-error': CustomEvent<{ error: unknown }>;
  'lyra-highlight-activate': CustomEvent<{ id: string }>;
}

/**
 * Fetches and safely renders an inline SVG document.
 *
 * @customElement lyra-svg-viewer
 * @event lyra-render-error - Fired when fetching or sanitizing the document fails.
 * @event lyra-highlight-activate - A region highlight was activated. `detail: { id }`.
 * @csspart base - The root container.
 * @csspart body - The wrapper around the fetched-state content.
 * @csspart svg - The sanitized SVG document, once loaded.
 * @csspart spinner - The loading region.
 * @csspart error - The error region.
 * @csspart frame-viewport - Forwarded from the internal `<lyra-zoomable-frame>` when `zoomable`.
 * @csspart frame-content - Forwarded from the internal `<lyra-zoomable-frame>` when `zoomable`.
 * @csspart frame-controls - Forwarded from the internal `<lyra-zoomable-frame>` when `zoomable`.
 * @csspart frame-zoom-in - Forwarded from the internal `<lyra-zoomable-frame>` when `zoomable`.
 * @csspart frame-zoom-out - Forwarded from the internal `<lyra-zoomable-frame>` when `zoomable`.
 * @csspart frame-reset - Forwarded from the internal `<lyra-zoomable-frame>` when `zoomable`.
 * @csspart highlight-layer - The wrapper around every rendered region highlight.
 * @csspart region-highlight - One region highlight (`data-tone`, `data-active`).
 * @cssprop [--lyra-svg-viewer-max-height=none] - Maximum block size of the scrollable body before it scrolls internally. Also settable via the `max-height` property.
 */
export class LyraSvgViewer extends LyraElement<LyraSvgViewerEventMap> {
  static styles = [LyraElement.styles, styles, srOnly];

  /** URL to fetch and render as sanitized inline SVG. */
  @property() src = '';

  /** Accessible name for the rendered SVG. */
  @property() name = '';

  /** CSS length that caps the scrollable body. */
  @property({ attribute: 'max-height' }) maxHeight = '';

  /** Wraps the rendered content in an internal `<lyra-zoomable-frame>`. `false` (the default)
   *  preserves today's exact DOM -- an inline thumbnail (e.g. in a chat stream) must not
   *  unexpectedly grow a focusable zoom-chrome viewport; an inspection surface opts in. */
  @property({ type: Boolean, reflect: true }) zoomable = false;

  /** Display-only region highlights (see the class doc's Boundaries note -- no creation UI here). */
  @property({ attribute: false }) highlights: LyraHighlight[] = [];
  @property({ attribute: 'active-highlight-id' }) activeHighlightId: string | null = null;
  readonly anchorKinds: LyraAnchor['kind'][] = ['region'];

  @state() private fetchState: SvgFetchState = { kind: 'idle' };
  private generation = 0;

  protected updated(changed: PropertyValues): void {
    if (changed.has('src')) this.scheduleAfterUpdate(() => { void this.load(); });
  }

  private async load(): Promise<void> {
    const generation = ++this.generation;
    const signal = this.beginAbortableLoad();
    if (!this.src) {
      this.fetchState = { kind: 'idle' };
      return;
    }
    const url = safeFetchUrl(this.src);
    if (!url) {
      this.fetchState = { kind: 'error', message: this.localize('documentPreviewUrlNotAllowed') };
      return;
    }
    this.fetchState = { kind: 'loading' };
    try {
      const response = await fetch(url, signal ? { signal } : undefined);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const sanitizer = await loadSvgSanitizer();
      if (!sanitizer) throw new LyraUserFacingError(this.localize('documentViewerMissingSanitizer'));
      const markup = sanitizer.sanitize(await readResponseText(response), { USE_PROFILES: { svg: true, svgFilters: true } });
      if (this.isConnected && generation === this.generation) this.fetchState = { kind: 'loaded', markup };
    } catch (error) {
      if (isAbortError(error) || !this.isConnected || generation !== this.generation) return;
      const message = error instanceof LyraUserFacingError
        ? error.message
        : this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'documentPreviewFailedToLoad');
      this.fetchState = { kind: 'error', message };
      this.emit('lyra-render-error', { error });
    }
  }

  private renderBody(): TemplateResult {
    switch (this.fetchState.kind) {
      case 'loaded':
        return this.renderZoomableWrapper(
          html`<div part="svg" role="img" aria-label=${this.name || this.localize('svgViewerLabel')}>${unsafeSVG(this.fetchState.markup)}</div>`,
        );
      case 'loading':
        return html`<div part="spinner" role="status"><span class="sr-only">${this.localize('loadingDocument')}</span></div>`;
      case 'error':
        return html`<div part="error" role="alert">${this.fetchState.message}</div>`;
      case 'idle':
      default:
        return html`<p class="empty-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeImage') })}</p>`;
    }
  }

  /** Wraps `content` in the internal `<lyra-zoomable-frame>` when `zoomable`; otherwise renders it
   *  (plus the highlight layer, which needs the same relatively-positioned sibling context either
   *  way) unwrapped, preserving pre-`zoomable` DOM exactly. */
  private renderZoomableWrapper(content: TemplateResult): TemplateResult {
    const inner = html`<div class="zoom-content">${content}${this.renderHighlightLayer()}</div>`;
    if (!this.zoomable) return inner;
    return html`<lyra-zoomable-frame
      exportparts="viewport:frame-viewport, content:frame-content, controls:frame-controls, zoom-in:frame-zoom-in, zoom-out:frame-zoom-out, reset:frame-reset"
    >${inner}</lyra-zoomable-frame>`;
  }

  private renderHighlightLayer(): TemplateResult | typeof nothing {
    const regionHighlights = this.highlights.filter(
      (h): h is LyraHighlight & { anchor: { kind: 'region'; rect: { x: number; y: number; width: number; height: number } } } =>
        h.anchor.kind === 'region',
    );
    if (!regionHighlights.length) return nothing;
    // Region rects are physical percent-of-render coordinates and the rendered SVG never
    // mirrors, so position with physical left/top -- logical inset-inline-start would flip the
    // overlay under RTL while the render underneath stays put.
    return html`<div part="highlight-layer">
      ${regionHighlights.map(
        (h) => html`<div
          part="region-highlight"
          data-id=${h.id}
          data-tone=${h.tone ?? 'accent'}
          ?data-active=${h.id === this.activeHighlightId}
          style="left:${h.anchor.rect.x}%;top:${h.anchor.rect.y}%;width:${h.anchor.rect.width}%;height:${h.anchor.rect.height}%"
          tabindex="0"
          role="button"
          aria-label=${h.label || this.localize('viewerHighlightLabel')}
          @click=${() => this.emit('lyra-highlight-activate', { id: h.id })}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              this.emit('lyra-highlight-activate', { id: h.id });
            }
          }}
        ></div>`,
      )}
    </div>`;
  }

  /** Scrolls a `region` highlight into view (by id, or a `LyraAnchor` directly -- matched back to
   *  its owning `LyraHighlight` by reference so `scrollToAnchor(highlight.anchor)` also resolves to
   *  the right box). Returns whether a matching, currently-rendered region was found -- there's no
   *  retry loop here (unlike the full `DocumentAnchorTarget` mixin) because this viewer's content
   *  is either already loaded or isn't; a caller invoking this before `src` has resolved simply
   *  gets `false`. */
  async scrollToAnchor(target: LyraAnchor | string): Promise<boolean> {
    const highlight =
      typeof target === 'string'
        ? this.highlights.find((h) => h.id === target)
        : this.highlights.find((h) => h.anchor === target);
    const anchor = highlight ? highlight.anchor : typeof target === 'string' ? undefined : target;
    if (!anchor || anchor.kind !== 'region' || this.fetchState.kind !== 'loaded') return false;
    await this.updateComplete;
    const region = highlight
      ? this.renderRoot.querySelector(`[part="region-highlight"][data-id="${CSS.escape(highlight.id)}"]`)
      : this.renderRoot.querySelector('[part="region-highlight"]');
    const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
    region?.scrollIntoView({ behavior, block: 'center', inline: 'center' });
    return true;
  }

  render(): TemplateResult {
    return html`<div part="base" style=${this.maxHeight ? `--lyra-svg-viewer-max-height:${this.maxHeight}` : nothing}>
      <div part="body">${this.renderBody()}</div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-svg-viewer': LyraSvgViewer;
  }
}
