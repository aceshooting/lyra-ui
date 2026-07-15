import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { safeFetchUrl } from '../../internal/safe-url.js';
import { srOnly } from '../../internal/a11y.js';
import { loadHtmlSanitizer } from './dompurify-loader.js';
import { styles } from './html-viewer.styles.js';

type HtmlFetchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; markup: string }
  | { kind: 'error'; message: string };

export interface LyraHtmlViewerEventMap {
  'lyra-render-error': CustomEvent<{ error: unknown }>;
}

/** Fetches and safely renders an inline HTML document. */
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

  protected willUpdate(changed: PropertyValues): void {
    if (!this.hasUpdated || changed.has('src')) void this.load();
  }

  private async load(): Promise<void> {
    const generation = ++this.generation;
    if (!this.src) { this.fetchState = { kind: 'idle' }; return; }
    const url = safeFetchUrl(this.src);
    if (!url) { this.fetchState = { kind: 'error', message: this.localize('documentPreviewUrlNotAllowed') }; return; }
    this.fetchState = { kind: 'loading' };
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const sanitizer = await loadHtmlSanitizer();
      if (!sanitizer) throw new Error(this.localize('documentViewerMissingSanitizer'));
      const markup = sanitizer.sanitize(await response.text());
      if (generation === this.generation) this.fetchState = { kind: 'loaded', markup };
    } catch (error) {
      if (generation !== this.generation) return;
      this.fetchState = { kind: 'error', message: error instanceof Error ? error.message : this.localize('documentPreviewFailedToLoad') };
      this.emit('lyra-render-error', { error });
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
    return html`<div part="base" style=${this.maxHeight ? `--lyra-html-viewer-max-height:${this.maxHeight}` : nothing}><div part="body">${this.renderBody()}</div></div>`;
  }
}

declare global { interface HTMLElementTagNameMap { 'lyra-html-viewer': LyraHtmlViewer; } }
