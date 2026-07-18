import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { safeFetchUrl } from '../../internal/safe-url.js';
import { isAbortError, isResourceLimitError, LyraUserFacingError, readResponseText } from '../../internal/resource-loader.js';
import { srOnly } from '../../internal/a11y.js';
import { loadHtmlSanitizer } from './dompurify-loader.js';
import { styles } from './html-viewer.styles.js';

type HtmlFetchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; markup: string }
  | { kind: 'error'; message: string };

export interface LyraHtmlViewerEventMap {
  'lr-render-error': CustomEvent<{ error: unknown }>;
}

/**
 * Fetches and safely renders an inline HTML document.
 *
 * @customElement lr-html-viewer
 * @event lr-render-error - Fired when fetching or sanitizing the document fails.
 * @csspart base - The root container.
 * @csspart body - The wrapper around the fetched-state content.
 * @csspart html - The sanitized HTML document, once loaded.
 * @csspart spinner - The loading region.
 * @csspart error - The error region.
 */
export class LyraHtmlViewer extends LyraElement<LyraHtmlViewerEventMap> {
  static styles = [LyraElement.styles, styles, srOnly];

  /** URL to fetch and render as sanitized inline HTML. */
  @property() src = '';
  /** Accessible name for the rendered HTML document. */
  @property() name = '';
  /** CSS length that caps the scrollable body. */
  @property({ attribute: 'max-height' }) maxHeight = '';

  @state() private fetchState: HtmlFetchState = { kind: 'idle' };
  private generation = 0;

  protected updated(changed: PropertyValues): void {
    if (changed.has('src')) this.scheduleAfterUpdate(() => { void this.load(); });
  }

  private async load(): Promise<void> {
    const generation = ++this.generation;
    const signal = this.beginAbortableLoad();
    if (!this.src) { this.fetchState = { kind: 'idle' }; return; }
    const url = safeFetchUrl(this.src);
    if (!url) { this.fetchState = { kind: 'error', message: this.localize('documentPreviewUrlNotAllowed') }; return; }
    this.fetchState = { kind: 'loading' };
    try {
      const response = await fetch(url, signal ? { signal } : undefined);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const sanitizer = await loadHtmlSanitizer();
      if (!sanitizer) throw new LyraUserFacingError(this.localize('documentViewerMissingSanitizer'));
      const markup = sanitizer.sanitize(await readResponseText(response));
      if (generation === this.generation) this.fetchState = { kind: 'loaded', markup };
    } catch (error) {
      if (isAbortError(error) || !this.isConnected || generation !== this.generation) return;
      this.fetchState = { kind: 'error', message: error instanceof LyraUserFacingError ? error.message : this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'documentPreviewFailedToLoad') };
      this.emit('lr-render-error', { error });
    }
  }

  private renderBody(): TemplateResult {
    switch (this.fetchState.kind) {
      case 'loaded': return html`<div part="html" role="document" aria-label=${this.name || this.localize('htmlViewerLabel')}>${unsafeHTML(this.fetchState.markup)}</div>`;
      case 'loading': return html`<div part="spinner" role="status"><span class="sr-only">${this.localize('loadingDocument')}</span></div>`;
      case 'error': return html`<div part="error" role="alert">${this.fetchState.message}</div>`;
      case 'idle':
      default: return html`<p class="empty-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeDocument') })}</p>`;
    }
  }

  render(): TemplateResult {
    return html`<div part="base" style=${this.maxHeight ? `--lr-html-viewer-max-height:${this.maxHeight}` : nothing}><div part="body">${this.renderBody()}</div></div>`;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-html-viewer': LyraHtmlViewer; } }
