import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { srOnly } from '../../internal/a11y.js';
import { safeFetchUrl } from '../../internal/safe-url.js';
import { loadDocxDeps, type DocxDeps } from './docx-loader.js';
import { styles } from './docx-viewer.styles.js';

type FetchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; markup: string }
  | { kind: 'error'; message: string };

export interface LyraDocxViewerEventMap {
  'lyra-render-error': CustomEvent<{ error: unknown }>;
}

/**
 * Renders a DOCX document as sanitized semantic HTML using the optional
 * `mammoth` converter and `dompurify` sanitizer peers. DOCX content is always
 * sanitized; there is no unsanitized rendering mode for uploaded documents.
 *
 * @customElement lyra-docx-viewer
 * @event lyra-render-error - Fired when loading, conversion, sanitization, or a non-fatal Mammoth message occurs.
 * @csspart base - The root container.
 * @csspart body - The scrollable document body.
 * @csspart content - The semantic document content.
 * @csspart error - The error message region.
 * @csspart spinner - The loading status region.
 */
export class LyraDocxViewer extends LyraElement<LyraDocxViewerEventMap> {
  static styles = [LyraElement.styles, styles, srOnly];

  /** URL to fetch and convert as a DOCX document. */
  @property() src = '';

  /** Accessible name for the rendered document. */
  @property() name = '';

  /** CSS length that caps the scrollable document body. */
  @property({ attribute: 'max-height' }) maxHeight = '';

  @state() private fetchState: FetchState = { kind: 'idle' };

  private generation = 0;
  private loadLibrary: () => Promise<DocxDeps> = loadDocxDeps;

  protected willUpdate(changed: PropertyValues): void {
    if (!this.hasUpdated || changed.has('src')) void this.load();
  }

  private async load(): Promise<void> {
    const generation = ++this.generation;
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
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const arrayBuffer = await response.arrayBuffer();
      const { mammoth, DOMPurify } = await this.loadLibrary();
      if (generation !== this.generation) return;
      if (!mammoth) {
        this.fetchState = { kind: 'error', message: this.localize('docxViewerMissingConverter') };
        return;
      }
      if (!DOMPurify) {
        this.fetchState = { kind: 'error', message: this.localize('documentViewerMissingSanitizer') };
        return;
      }

      const converted = (await mammoth.convertToHtml({ arrayBuffer })) as { value: string; messages: unknown[] };
      if (generation !== this.generation) return;
      this.fetchState = { kind: 'loaded', markup: DOMPurify.sanitize(converted.value) };
      if (converted.messages.length > 0) this.emit('lyra-render-error', { error: converted.messages });
    } catch (error) {
      if (generation !== this.generation) return;
      this.fetchState = {
        kind: 'error',
        message: error instanceof Error ? error.message : this.localize('documentPreviewFailedToLoad'),
      };
      this.emit('lyra-render-error', { error });
    }
  }

  private renderBody(): TemplateResult {
    switch (this.fetchState.kind) {
      case 'loaded':
        return html`
          <div part="content" role="document" aria-label=${this.name || this.localize('docxViewerLabel')}>
            ${unsafeHTML(this.fetchState.markup)}
          </div>
        `;
      case 'loading':
        return html`<div part="spinner" role="status"><span class="sr-only">${this.localize('loadingDocument')}</span></div>`;
      case 'error':
        return html`<div part="error" role="alert">${this.fetchState.message}</div>`;
      case 'idle':
      default:
        return html`<p class="empty-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeDocument') })}</p>`;
    }
  }

  render(): TemplateResult {
    return html`
      <div
        part="base"
        style=${this.maxHeight ? `--lyra-docx-viewer-max-height:${this.maxHeight}` : nothing}
      >
        <div part="body">${this.renderBody()}</div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-docx-viewer': LyraDocxViewer;
  }
}
