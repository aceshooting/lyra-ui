import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { srOnly } from '../../../internal/a11y.js';
import { TextViewerTarget, type LyraTextViewerTargetEventMap } from '../../../internal/text-viewer-target.js';
import { isAbortError, isResourceLimitError, readResponseArrayBuffer, resolveOwnerFetchTarget } from '../../../internal/resource-loader.js';
import { sanitizeCssLength } from '../../../internal/safe-css.js';
import { chevronIcon } from '../../../internal/icons.js';
import {
  getPptxRenderer,
  type PptxRendererModule,
  type PptxViewerApi,
} from './pptx-loader.js';
import { assertPptxArchiveWithinLimits } from './pptx-resource-guard.js';
import { styles } from './pptx-viewer.styles.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { ViewerAnnouncementController } from '../viewer-announcements.js';
import type { AnchorResultDetail, TextSelectDetail } from '../document-viewer/anchors.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound, LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_documentPreviewFailedToLoad, LYRA_DEFAULT_documentPreviewResourceTooLarge, LYRA_DEFAULT_documentPreviewUrlNotAllowed, LYRA_DEFAULT_loading, LYRA_DEFAULT_open, LYRA_DEFAULT_pptxViewerFidelityNotice, LYRA_DEFAULT_pptxViewerLabel, LYRA_DEFAULT_pptxViewerNextSlide, LYRA_DEFAULT_pptxViewerPreviousSlide, LYRA_DEFAULT_pptxViewerRenderError, LYRA_DEFAULT_pptxViewerSlideOf } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


type PptxPhase = 'idle' | 'loading' | 'mounted' | 'error';

export interface LyraPptxViewerEventMap extends LyraTextViewerTargetEventMap {
  'lr-load': CustomEvent<{ slideCount: number }>;
  'lr-slide-change': CustomEvent<{ index: number; count: number }>;
  'lr-render-error': CustomEvent<{ error: unknown }>;
  'lr-search-change': CustomEvent<{ query: string; matchCount: number; activeIndex: number }>;
  'lr-anchor-result': CustomEvent<AnchorResultDetail>;
  'lr-text-select': CustomEvent<TextSelectDetail>;
}

class LyraPptxViewerBase extends LyraElement<LyraPptxViewerEventMap> {}

/**
 * Best-effort client-side PPTX viewer backed by `@aiden0z/pptx-renderer`.
 * The fidelity notice is intentionally always visible because animations,
 * equations, embedded OLE objects, notes, and several advanced effects are
 * not represented by the renderer.
 * Remote bytes and measured ZIP expansion are bounded before renderer-owned parsing begins; a
 * peer that does not expose a complete, safely bounded ZIP-limits capability fails closed.
 *
 * @customElement lr-pptx-viewer
 * @event lr-load - Fired after a presentation opens. `detail: { slideCount }`.
 * @event lr-slide-change - Fired when the active slide changes.
 * @event lr-render-error - Fired when fetching or rendering fails.
 * @event {CustomEvent<{ query: string; matchCount: number; activeIndex: number }>} lr-search-change -
 *   Fired whenever search state changes. `detail: { query: string; matchCount: number;
 *   activeIndex: number }`. Bubbling, composed, and non-cancelable.
 * @event {CustomEvent<AnchorResultDetail>} lr-anchor-result - Fired after an `anchor` assignment or
 *   `scrollToAnchor()` call is applied. `detail: { found: boolean }`. Bubbling, composed, and
 *   non-cancelable.
 * @event {CustomEvent<TextSelectDetail>} lr-text-select - Fired after a selection ends inside the
 *   rendered presentation. `detail: { text: string; anchor: LyraAnchor | null; rects: DOMRect[] }`.
 *   Bubbling, composed, and non-cancelable.
 * @csspart base - The named viewer region with explicit `aria-busy`; its ordinary visually-hidden
 *   loading label is announced on later transitions through the shared document-level polite sink.
 * @csspart header - The optional presentation-name row.
 * @csspart name - The presentation name.
 * @csspart notice - The persistent fidelity notice.
 * @csspart error - Visible ordinary error text; transitions announce through the shared
 *   document-level assertive region.
 * @csspart nav - Slide navigation controls.
 * @csspart previous-button - Previous-slide button.
 * @csspart previous-icon - Previous-slide icon.
 * @csspart slide-count - Current slide indicator.
 * @csspart next-button - Next-slide button.
 * @csspart next-icon - Next-slide icon.
 * @csspart container - The renderer-owned output container.
 * @cssprop [--lr-pptx-viewer-max-height=none] - Maximum block size of the scrollable renderer
 *   output container before it scrolls internally. Also settable via the `max-height` property.
 * @status stable
 * @since 4.0.0
 */
export class LyraPptxViewer extends TextViewerTarget(LyraPptxViewerBase) {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    anchorJumped: LYRA_DEFAULT_anchorJumped,
    anchorJumpedToPage: LYRA_DEFAULT_anchorJumpedToPage,
    anchorNotFound: LYRA_DEFAULT_anchorNotFound,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    documentPreviewFailedToLoad: LYRA_DEFAULT_documentPreviewFailedToLoad,
    documentPreviewResourceTooLarge: LYRA_DEFAULT_documentPreviewResourceTooLarge,
    documentPreviewUrlNotAllowed: LYRA_DEFAULT_documentPreviewUrlNotAllowed,
    loading: LYRA_DEFAULT_loading,
    open: LYRA_DEFAULT_open,
    pptxViewerFidelityNotice: LYRA_DEFAULT_pptxViewerFidelityNotice,
    pptxViewerLabel: LYRA_DEFAULT_pptxViewerLabel,
    pptxViewerNextSlide: LYRA_DEFAULT_pptxViewerNextSlide,
    pptxViewerPreviousSlide: LYRA_DEFAULT_pptxViewerPreviousSlide,
    pptxViewerRenderError: LYRA_DEFAULT_pptxViewerRenderError,
    pptxViewerSlideOf: LYRA_DEFAULT_pptxViewerSlideOf,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  // `srOnly` keeps the anchor-target mixin's aria-hidden diagnostic mirror from painting as a
  // visible row under the fidelity notice. The spoken copy lives in the document-level sink.
  static override styles = [LyraElement.styles, styles, srOnly];

  /** URL of the PPTX file. */
  @property() src = '';
  /** Optional presentation name. */
  @property() name = '';
  /** Accessible-name override for the viewer region. */
  @property() label = '';
  /** A CSS `max-height` that caps the scrollable renderer output container; invalid values are ignored. */
  @property({ attribute: 'max-height' }) maxHeight = '';
  /** Shared text search and anchor-target API for renderer output when it exposes DOM text. */
  override async search(query: string): Promise<number> { return super.search(query); }
  override async searchNext(): Promise<boolean> { return super.searchNext(); }
  override async searchPrevious(): Promise<boolean> { return super.searchPrevious(); }
  override clearSearch(): void { super.clearSearch(); }

  @state() private phase: PptxPhase = 'idle';
  @state() private errorMessage = '';
  @state() private slideCount = 0;
  @state() private currentSlideIndex = 0;
  @query('[part="container"]') private containerEl?: HTMLElement;

  /** @internal Test seam for replacing the optional renderer. */
  loadRenderer: () => Promise<PptxRendererModule | null> = getPptxRenderer;
  private viewer?: PptxViewerApi;
  private generation = 0;
  private readonly announcements = new ViewerAnnouncementController(this);

  protected textContentRoot(): Element | null {
    return this.renderRoot.querySelector('[part="container"]') ?? this.renderRoot.querySelector('[part="base"]');
  }

  private onSlideChange = (event: Event): void => {
    const index = (event as CustomEvent<{ index: number }>).detail.index;
    this.currentSlideIndex = index;
    this.emit('lr-slide-change', { index, count: this.slideCount });
  };

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.announcements.transition(
      'load',
      this.phase,
      this.phase === 'error' ? this.errorMessage : this.localize('loading'),
    );
    if (changed.has('src')) this.scheduleAfterUpdate(() => { void this.mount(); });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.announcements.connect();
    // A reconnect (e.g. a drag-and-drop reparent, a tab/panel re-hosting its
    // children, a virtualized list moving this same element instance) fires
    // disconnectedCallback then connectedCallback synchronously with no
    // update in between, so updated()'s `changed.has('src')` gate never
    // fires again to remount the presentation. disconnectedCallback already
    // reset `phase` to idle and tore the renderer down, so re-arm the mount
    // here whenever there's a `src` to load and this isn't the very first
    // connect (that case is already covered by updated()'s initial-render
    // gate).
    if (this.hasUpdated && this.src) this.scheduleAfterUpdate(() => { void this.mount(); });
  }

  override disconnectedCallback(): void {
    this.teardown();
    // Reset rather than leaving stale "mounted" state behind: without this,
    // a reconnect that isn't followed by a fresh mount (src unset, or the
    // reconnect races ahead of connectedCallback's remount) would keep
    // rendering the nav/slide controls as if a presentation were still
    // loaded, against a destroyed renderer -- an empty container with
    // live-looking prev/next buttons that silently no-op every click,
    // instead of an empty/idle state.
    this.phase = 'idle';
    this.slideCount = 0;
    this.currentSlideIndex = 0;
    this.announcements.disconnect();
    super.disconnectedCallback();
  }

  adoptedCallback(): void {
    this.announcements.adopted();
  }

  async goToSlide(index: number): Promise<void> { await this.viewer?.goToSlide(index); }

  private teardown(): void {
    this.generation++;
    this.viewer?.removeEventListener('slidechange', this.onSlideChange);
    this.viewer?.destroy();
    this.viewer = undefined;
  }

  private async mount(): Promise<void> {
    this.teardown();
    const signal = this.beginAbortableLoad();
    const generation = this.generation;
    if (!this.src) { this.phase = 'idle'; return; }
    const fetchTarget = resolveOwnerFetchTarget(this, this.src);
    if (!fetchTarget) {
      const error = new Error(this.localize('documentPreviewUrlNotAllowed'));
      this.phase = 'error';
      this.errorMessage = error.message;
      this.emit('lr-render-error', { error });
      return;
    }
    this.phase = 'loading';
    let module: PptxRendererModule | null;
    let response: Response;
    try {
      [module, response] = await Promise.all([
        this.loadRenderer(),
        fetchTarget.view.fetch(fetchTarget.url, signal ? { signal } : undefined),
      ]);
    } catch (error) {
      if (isAbortError(error) || !this.isConnected || generation !== this.generation) return;
      this.phase = 'error';
      this.errorMessage = this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'documentPreviewFailedToLoad');
      this.emit('lr-render-error', { error });
      return;
    }
    if (!this.isConnected || generation !== this.generation) return;
    if (!module || !response.ok) {
      const error = new Error(
        this.localize(module ? 'documentPreviewFailedToLoad' : 'pptxViewerRenderError'),
      );
      this.phase = 'error';
      this.errorMessage = error.message;
      this.emit('lr-render-error', { error });
      return;
    }
    let buffer: ArrayBuffer;
    try {
      buffer = await readResponseArrayBuffer(response);
      if (!this.isConnected || generation !== this.generation) return;
      await assertPptxArchiveWithinLimits(buffer, { signal });
    } catch (error) {
      if (isAbortError(error) || !this.isConnected || generation !== this.generation) return;
      this.phase = 'error';
      this.errorMessage = this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'documentPreviewFailedToLoad');
      this.emit('lr-render-error', { error });
      return;
    }
    if (!this.isConnected || generation !== this.generation) return;
    this.phase = 'mounted';
    await this.updateComplete;
    if (!this.isConnected || generation !== this.generation || !this.containerEl) return;
    try {
      const viewer = await module.PptxViewer.open(buffer, this.containerEl, {
        zipLimits: module.RECOMMENDED_ZIP_LIMITS,
        listOptions: { windowed: true },
      });
      if (!this.isConnected || generation !== this.generation) { viewer.destroy(); return; }
      this.viewer = viewer;
      viewer.addEventListener('slidechange', this.onSlideChange);
      this.slideCount = viewer.slideCount;
      this.currentSlideIndex = viewer.currentSlideIndex;
      this.emit('lr-load', { slideCount: viewer.slideCount });
    } catch (error) {
      if (isAbortError(error) || !this.isConnected || generation !== this.generation) return;
      this.phase = 'error';
      this.errorMessage = this.localize('pptxViewerRenderError');
      this.emit('lr-render-error', { error });
    }
  }

  private renderBody(): TemplateResult | typeof nothing {
    if (this.phase === 'loading') return html`
      <lr-skeleton variant="rect" .announce=${false}></lr-skeleton>
      <span class="sr-only">${this.localize('loading')}</span>
    `;
    if (this.phase === 'error') return html`<div part="error">${this.errorMessage}</div>`;
    if (this.phase !== 'mounted') return nothing;
    return html`
      <div part="nav" ?hidden=${this.slideCount <= 1}>
        <button part="previous-button" type="button" aria-label=${this.localize('pptxViewerPreviousSlide')} ?disabled=${this.currentSlideIndex <= 0} @click=${() => this.goToSlide(this.currentSlideIndex - 1)}>
          <span part="previous-icon" aria-hidden="true">${chevronIcon()}</span>
        </button>
        <span part="slide-count">${this.localize('pptxViewerSlideOf', undefined, {
          current: getNumberFormat(this.effectiveLocale).format(this.currentSlideIndex + 1),
          total: getNumberFormat(this.effectiveLocale).format(this.slideCount),
        })}</span>
        <button part="next-button" type="button" aria-label=${this.localize('pptxViewerNextSlide')} ?disabled=${this.currentSlideIndex >= this.slideCount - 1} @click=${() => this.goToSlide(this.currentSlideIndex + 1)}>
          <span part="next-icon" aria-hidden="true">${chevronIcon()}</span>
        </button>
      </div>
      <div part="container"></div>
    `;
  }

  override render(): TemplateResult {
    const ariaLabel = this.getAttribute('aria-label') || this.label || this.name || this.localize('pptxViewerLabel');
    return html`
      <div
        part="base"
        role="region"
        aria-label=${ariaLabel}
        aria-busy=${this.phase === 'loading' ? 'true' : 'false'}
        style=${sanitizeCssLength(this.maxHeight)
          ? styleMap({ '--lr-pptx-viewer-max-height': sanitizeCssLength(this.maxHeight)! })
          : nothing}
      >
        <div part="header" ?hidden=${!this.name}><span part="name">${this.name}</span></div>
        <p part="notice" role="note">${this.localize('pptxViewerFidelityNotice')}</p>
        ${this.renderBody()}${this.renderAnchorLiveRegion()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'lr-pptx-viewer': LyraPptxViewer; }
}
